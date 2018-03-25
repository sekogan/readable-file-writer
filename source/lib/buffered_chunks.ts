export default class BufferedChunks
{
    private _start: number = 0;
    private _end: number = 0;
    private _chunks: Buffer[] = [];

    constructor(private readonly maxLength: number)
    {}
    
    get start(): number
    {
        return this._start;
    }

    get end(): number
    {
        return this._end;
    }

    get length(): number
    {
        return this._end - this._start;
    }

    get(offset: number): Buffer
    {
        let start = this._start;
        for (const chunk of this._chunks)
        {
            if (offset < start + chunk.length)
                return chunk.slice(offset - start);
            start += chunk.length;
        }
        throw new Error(`Offset ${offset} is not in range (${this._start}, ${this._end})`);
    }

    push(chunk: Buffer): void
    {
        this._chunks.push(chunk);
        this._end += chunk.length;
        while (this.length > this.maxLength && this._chunks.length > 1)
        {
            const lastChunk = this._chunks.shift();
            this._start += lastChunk!.length;
        }
    }
}
