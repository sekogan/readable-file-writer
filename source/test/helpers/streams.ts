import * as Random from './random';
import pump from './async_pump';
import * as Stream from 'readable-stream';
import Crypto = require('crypto');

export const Delays = {
    big: () => 50,
    none: () => 0,
    random: () => Random.getInt(0, 51),
};

export function createReadable()
{
    return new Stream.Readable({ read: ()=>{} });
}

export function readableFrom(value: string|Buffer): NodeJS.ReadableStream
{
    const stream = createReadable();
    if (value)
        stream.push(value);
    stream.push(null);
    return stream;
}

export interface RandomDataSourceOptions
{
    size: number,
    chunkSize: number;
    delays: () => number;
}

export async function createRandomDataSource(
    options: RandomDataSourceOptions
): Promise<NodeJS.ReadableStream>
{
    const chunks = await Random.generateChunks(10, options.chunkSize);
    let bytesSent = 0;

    return new Stream.Readable({
        read()
        {
            const delay = options.delays();
            if (delay === 0)
                pushData(this);
            else
                setTimeout(() => pushData(this), delay);
        }
    })

    function pushData(stream: Stream.Readable): void
    {
        if (bytesSent >= options.size)
        {
            stream.push(null);
            return;
        }
        const chunkSize = Math.min(options.size - bytesSent, options.chunkSize);
        const chunkIndex = Random.getInt(0, chunks.length);
        bytesSent += chunkSize;
        stream.push(chunks[chunkIndex].slice(0, chunkSize));
    }
}

export function createNullWritable(delays: () => number = Delays.none)
{
    return new Stream.Writable({
        write(_chunk, _encoding, cb)
        {
            const delay = delays();
            if (delay === 0)
                cb()
            else
                setTimeout(cb, delay);
        }
    })
}

export class BackpressureTestingWritable extends Stream.Writable
{
    private _writeCallback: null|(() => void) = null;
    private _chunksReceived = 0;

    constructor() { super() }

    get chunksReceived()
    {
        return this._chunksReceived;
    }

    makeReady()
    {
        if (this._writeCallback)
        {
            const callback = this._writeCallback;
            this._writeCallback = null;
            callback();
        }
    }

    _write(_chunk: Buffer|string, _encoding: string, cb: () => void)
    {
        this._chunksReceived++;
        this._writeCallback = cb;
    }
}

export function throughMd5Calculator(
    callback: (hash: string) => void
)
{
    const hash = Crypto.createHash('md5');
    return new Stream.Transform({
        transform(chunk, encoding, cb)
        {
            hash.update(chunk, encoding as any);
            cb(null, chunk);
        },
        flush(cb)
        {
            callback(hash.digest('hex'));
            cb();
        }
    });
}

export function throughTracer(
    streamName: string,
    tracer: { log(string: string): void },
)
{
    let nextChunkNumber = 0;
    let offset = 0;
    return new Stream.Transform({
        transform(chunk: string|Buffer, _encoding, cb)
        {
            const chunkId = typeof chunk === 'string' ?
                `"${chunk.slice(0, 8)}"` : chunk.slice(0, 4).toString('hex');
            tracer.log(`${streamName}[${nextChunkNumber++}]: ${chunkId} size=${chunk.length} offset=${offset}`);
            offset += chunk.length;
            cb(null, chunk);
        },
        flush(cb)
        {
            tracer.log(`${streamName}[${nextChunkNumber++}]: end offset=${offset}`);
            cb();
        }
    });
}

export async function pumpToString(input: NodeJS.ReadableStream): Promise<string>
{
    let result = '';
    const output = new Stream.Writable({
        write(chunk, _encoding, callback)
        {
            result += chunk;
            callback();
        }
    });
    await pump(input, output);
    return result;
}
