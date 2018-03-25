import ReadableFileWriter from '../../lib/readable_file_writer';
import * as StreamHelpers from '../helpers/streams';
import * as WorkingDir from '../helpers/working_dir';
import pump from '../helpers/async_pump';
import * as Path from 'path';
import * as Fs from 'fs';

const AFileName = Path.join(WorkingDir.path, 'foo');
const TestStreamSize = 1*1024*1024*1024;
const TestChunkSize = 64*1024;

async function main()
{
    try
    {
        await WorkingDir.create();

        // Run the test once without measuring to warm up everything
        testNodeFileWriter();

        console.log(`Copying ${TestStreamSize} bytes through node's FileWriter`);
        console.time('OK');
        testNodeFileWriter();
        console.timeEnd('OK');

        console.log(`Copying ${TestStreamSize} bytes through ReadableFileWriter`);
        console.time('OK');
        testReadableFileWriter();
        console.timeEnd('OK');
    }
    finally
    {
        await WorkingDir.remove();
    }
}

async function testReadableFileWriter()
{
    const writer = new ReadableFileWriter(AFileName);
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

async function testNodeFileWriter()
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

main().catch(error => {
    console.error(error.stack);
    process.exit(1);
});
