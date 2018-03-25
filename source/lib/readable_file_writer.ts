import BufferedChunks from './buffered_chunks';
import Multistream = require('multistream');
import * as Stream from 'readable-stream';
import * as Fs from 'fs';

const Defaults: Options = {
    bufferSize: 1*1024*1024,
    fileReaderHighWaterMark: 128*1024,
}

export interface Options
{
    bufferSize: number;
    fileReaderHighWaterMark: number;
}

export default class ReadableFileWriter extends Stream.Writable
{
    private fileWriter = Fs.createWriteStream(this.path, {
        flags: 'w',
        encoding: undefined,
    });
    private error: Error|undefined;
    private ended = false;
    private buffer = new BufferedChunks(this.options.bufferSize || Defaults.bufferSize);

    constructor(
        public readonly path: string,
        private readonly options: Partial<Options> = {}
    )
    {
        super();
        this.fileWriter.on('open', fd => this.emit('open', fd));
        this.fileWriter.on('close', () => this.emit('close'));
        this.fileWriter.on('error', error => this.handleError(error));
    }

    createReadStream(): NodeJS.ReadableStream
    {
        const reader: Reader = {
            bytesAdded: 0,
            needMoreData: false,
            push: null,
        };
        const stream = Multistream(cb => {
            reader.needMoreData = true;
            reader.push = cb;
            setImmediate(() => this.awakeReader(reader)); // setImmediate is used to let the client set up an error listener
        });
        this.on('_awakeReaders', () => {
            this.awakeReader(reader);
        });
        return stream;
    }

    _write(
        chunk: Buffer,
        _encoding: string,
        cb: (error?: Error) => void
    ): any
    {
        if (this.error)
            return cb(this.error);
        this.buffer.push(chunk);
        this.fileWriter.write(chunk, _encoding, (error?: Error) => {
            if (error)
                this.handleError(error);
            cb(this.error);
            this.emit('_awakeReaders');
        });
        this.emit('_awakeReaders');
    }

    _final(
        cb: (error?: Error) => void
    ): void
    {
        this.ended = true;
        this.fileWriter.end((error?: Error) => {
            if (error)
                this.handleError(error);
            cb(this.error);
            this.emit('_awakeReaders');
        });
        this.emit('_awakeReaders');
    }

    _destroy(
        error: Error,
        cb: (error?: Error) => void
    )
    {
        this.ended = true;
        this.fileWriter.destroy(error);
        if (error)
            this.handleError(error);
        this.fileWriter.once('close', () => cb(this.error));
    }

    private handleError(error: Error): void
    {
        if (this.error)
            return;
        this.error = error;
        this.emit('error', error);
        this.emit('_awakeReaders');
    }

    private awakeReader(reader: Reader): void
    {
        if (!reader.needMoreData)
            return;
        if (!reader.push)
            throw new Error('Non-null push is expected');
        reader.needMoreData = false;

        if (this.error)
        {
            reader.push(this.error, null);
            return;
        }

        // No more data for reader?
        if (reader.bytesAdded === this.buffer.end)
        {
            if (this.ended)
                return reader.push(null, null);
            reader.needMoreData = true;
            return;
        }

        // Any data for reader in the memory buffer?
        if (reader.bytesAdded >= this.buffer.start)
        {
            const chunk = this.buffer.get(reader.bytesAdded);
            reader.bytesAdded += chunk.length;
            reader.push(null, createChunkStream(chunk));
            return;
        }

        // Feed it from the file
        const start = reader.bytesAdded;
        const end = this.fileWriter.bytesWritten;
        if (start === end)
        {
            reader.needMoreData = true;
            return; // Wait while data is being written to the file
        }
        reader.bytesAdded = end;
        reader.push(null, Fs.createReadStream(this.path, {
            flags: 'r',
            encoding: undefined,
            start,
            end: end - 1, // end is inclusive
            highWaterMark: this.options.fileReaderHighWaterMark,
        }));
    }
}

function createChunkStream(chunk: Buffer): NodeJS.ReadableStream
{
    const stream = new Stream.Readable({ read() {} });
    stream.push(chunk);
    stream.push(null);
    return stream;
}

interface MultistreamCallback
{
    (error: null, next: null): void;
    (error: Error, next: null): void;
    (error: null, next: NodeJS.ReadableStream): void;
}

interface Reader
{
    bytesAdded: number;
    needMoreData: boolean;
    push: MultistreamCallback|null;
}
