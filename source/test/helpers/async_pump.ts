import pump = require('pump');

export async function asyncPump(
    ...streams: Array<NodeJS.ReadableStream|NodeJS.WritableStream>
    ): Promise<void>
{
    return new Promise<void>((resolve, reject) => {
        pump(...streams, error => {
            if (error)
                reject(error)
            else
                resolve()
        })
    })
}
