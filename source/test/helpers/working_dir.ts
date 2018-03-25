import * as Fs from 'fs-extra';
import * as Path from 'path';
import * as OS from 'os';

export const path = Path.join(OS.tmpdir(),
    Path.basename(Path.normalize(Path.join(__dirname, '..', '..')))
);

export async function create(): Promise<void>
{
    await busyWait(() => Fs.emptyDir(path));
}

export async function remove(): Promise<void>
{
    await busyWait(() => Fs.remove(path));
}

async function delay(ms: number): Promise<void>
{
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function busyWait(cb: () => Promise<void>): Promise<void>
{
    while (true)
        try
        {
            return cb();
        }
        catch (error)
        {
            await delay(40);
        }
}
