import { ReadableFileWriter } from '../../lib/readable_file_writer';
import StreamHelpers = require('../helpers/streams');
import WorkingDir = require('../helpers/working_dir');
import { asyncPump as pump } from '../helpers/async_pump';
import Path = require('path');
import Fs = require('fs');

export const AFileName = Path.join(WorkingDir.path, 'foo');
export const TestStreamSize = 1*1024*1024*1024;
export const TestChunkSize = 64*1024;
export const TestBufferSize = 64*1024;

export async function testReadableFileWriter()
{
    const writer = new ReadableFileWriter(AFileName, { bufferSize: TestBufferSize });
    const dataSource = await StreamHelpers.createRandomDataSource({
        size: TestStreamSize,
        chunkSize: TestChunkSize,
        delays: StreamHelpers.Delays.none,
    });
    const reader = writer.createReadStream();
    await Promise.all([
        new Promise(resolve => writer.once('close', resolve)),
        pump(dataSource, writer),
        pump(reader, StreamHelpers.createNullWritable()),
    ]);
}

export async function testNodeFileWriter()
{
    const writer = Fs.createWriteStream(AFileName);
    const dataSource = await StreamHelpers.createRandomDataSource({
        size: TestStreamSize,
        chunkSize: TestChunkSize,
        delays: StreamHelpers.Delays.none,
    });
    await Promise.all([
        new Promise(resolve => writer.once('close', resolve)),
        pump(dataSource, writer),
    ]);
}
