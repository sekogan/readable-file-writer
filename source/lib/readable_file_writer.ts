import { BufferedChunks } from './buffered_chunks';
import Multistream = require('multistream');
import Stream = require('readable-stream');
import Fs = require('fs');

const DefaultOptions: Options = {
    bufferSize: 1*1024*1024,
}

export interface Options
{
    bufferSize: number;
}

const DefaultReadStreamOptions = {
    highWaterMark: 128*1024,
}

export interface ReadStreamOptions
{
    highWaterMark: number;
}

const enum State
{
    Created,
    Ended,
    Destroyed,
}

export class ReadableFileWriter extends Stream.Writable
{
    private fileWriter = Fs.createWriteStream(this.path, {
        flags: 'w',
        encoding: undefined,
    });
    private error: Error|undefined;
    private state = State.Created;
    private buffer = new BufferedChunks(this.options.bufferSize);

    constructor(
        public readonly path: string,
        private readonly options = DefaultOptions
    )
    {
        super();
        this.fileWriter.on('open', fd => this.emit('open', fd));
        this.fileWriter.on('close', () => this.emit('close'));
        this.fileWriter.on('error', error => this.handleError(error));
    }

    createReadStream(
        options = DefaultReadStreamOptions
    ): NodeJS.ReadableStream
    {
        const reader: Reader = {
            options,
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
            return cb();
        this.buffer.push(chunk);
        this.fileWriter.write(chunk, _encoding, (_error?: Error) => {
            cb();
            this.emit('_awakeReaders');
        });
        this.emit('_awakeReaders');
    }

    _final(
        cb: (error?: Error) => void
    ): void
    {
        if (this.error)
            return cb();
        this.state = State.Ended;
        this.fileWriter.end((_error?: Error) => {
            cb();
            this.emit('_awakeReaders');
        });
        this.emit('_awakeReaders');
    }

    _destroy(
        error: Error,
        cb: (error?: Error) => void
    )
    {
        if (error)
            this.handleError(error);
        if (!this.error)
        {
            this.fileWriter.destroy();
            this.state = State.Destroyed;
            this.emit('_awakeReaders');
        }
        cb();
    }

    private handleError(error: Error): void
    {
        if (this.error)
            return;
        this.error = error;
        this.fileWriter.destroy();
        this.state = State.Destroyed;
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
            if (this.state === State.Ended || this.state === State.Destroyed)
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
            ...reader.options
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
    readonly options: ReadStreamOptions;
    bytesAdded: number;
    needMoreData: boolean;
    push: MultistreamCallback|null;
}
