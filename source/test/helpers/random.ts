import Crypto = require('crypto');
import Util = require('util');

export async function generateChunks(
    number: number, size: number
): Promise<Buffer[]>
{
    const result: Buffer[] = [];
    for (let i = 0; i < number; ++i)
        result.push(await generateChunk(size));
    return result;
}

const randomBytes = Util.promisify(Crypto.randomBytes);

export async function generateChunk(size: number): Promise<Buffer>
{
    return randomBytes(size);
}

export function getInt(min: number, max: number): number
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}
