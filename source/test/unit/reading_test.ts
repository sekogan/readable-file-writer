import ReadableFileWriter from '../../lib/readable_file_writer';
import * as WorkingDir from '../helpers/working_dir';
import * as StreamHelpers from '../helpers/streams';
import pump from '../helpers/async_pump';
import * as Fs from 'fs-extra';
import * as Path from 'path';
import assert from 'assert';

const AFileName = Path.join(WorkingDir.path, 'foo');

describe('reading', () => {

    beforeEach(WorkingDir.create)
    afterEach(WorkingDir.remove)

    it('should copy data to reader if reader created when sut is not piped', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const reader = sut.createReadStream();
        const [ data ] = await Promise.all([
            StreamHelpers.pumpToString(reader),
            pump(StreamHelpers.readableFrom('abc'), sut),
        ]);
        assert.equal(data, 'abc');
    })

    it('should copy data to reader if reader created when sut is not piped, and reading is postponed', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const reader = sut.createReadStream();
        await pump(StreamHelpers.readableFrom('abc'), sut);
        const data = await StreamHelpers.pumpToString(reader);
        assert.equal(data, 'abc');
    })

    it('should copy data to reader if reader created when file is being written', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const source = StreamHelpers.createReadable();
        const dataWrittenPromise = pump(source, sut);

        source.push('abc');

        const reader = sut.createReadStream();
        const dataPromise = StreamHelpers.pumpToString(reader);

        source.push('def');
        source.push(null);

        const [ data ] = await Promise.all([
            dataPromise,
            dataWrittenPromise,
        ]);
        assert.equal(data, 'abcdef');
    })

    it('should copy data to reader if reader created when file is being written and reading is postponed', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const source = StreamHelpers.createReadable();
        const dataWrittenPromise = pump(source, sut);

        source.push('abc');

        const reader = sut.createReadStream();

        source.push('def');
        source.push(null);

        await dataWrittenPromise;
        const data = await StreamHelpers.pumpToString(reader);
        assert.equal(data, 'abcdef');
    })

    it('should copy data to reader if reader created when file is finished', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const source = StreamHelpers.readableFrom('abc');
        await pump(source, sut);

        const reader = sut.createReadStream();
        const data = await StreamHelpers.pumpToString(reader);
        assert.equal(data, 'abc');
    })

    it('should propagate the end to reader if there is no data', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const source = StreamHelpers.createReadable();
        source.push(null);
        await pump(source, sut);

        const reader = sut.createReadStream();
        const data = await StreamHelpers.pumpToString(reader);
        assert.equal(data, '');
    })

    it('should copy data to multiple readers in parallel', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const source = StreamHelpers.readableFrom('DATA');

        const [ data1, data2 ] = await Promise.all([
            StreamHelpers.pumpToString(sut.createReadStream()),
            StreamHelpers.pumpToString(sut.createReadStream()),
            pump(source, sut)
        ]);
        assert.equal(data1, 'DATA');
        assert.equal(data2, 'DATA');
    })

    it('should respect backpressure in reading pipe', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const source = StreamHelpers.createReadable();

        const writable = new StreamHelpers.BackpressureTestingWritable();

        const writingPipePromise = pump(source, sut);
        const readingPipePromise = pump(sut.createReadStream(), writable);

        source.push('DATA1');
        source.push('DATA2');
        source.push('DATA3');
        source.push(null);

        await delay(50);
        assert.equal(writable.chunksReceived, 1);
        writable.makeReady();
        await delay(50);
        assert.equal(writable.chunksReceived, 2);
        writable.makeReady();
        await delay(50);
        assert.equal(writable.chunksReceived, 3);
        writable.makeReady();

        await Promise.all([ writingPipePromise, readingPipePromise ]);
    })

    it('should propagate error from writer to active reader', async () => {
        const source = StreamHelpers.readableFrom('DATA');
        const sut = new ReadableFileWriter(AFileName);
        sut.on('open', fd => Fs.closeSync(fd));

        const reader = sut.createReadStream();
        const dataPromise = StreamHelpers.pumpToString(reader)
            .catch(error => error);

        await pump(source, sut)
            .catch(() => {}); // Ignore errors in the main pipeline
        const data = await dataPromise;
        assert(data instanceof Error);
    })

    it('should propagate error from writer to new readers', async () => {
        const source = StreamHelpers.readableFrom('DATA');
        const sut = new ReadableFileWriter(AFileName);
        sut.on('open', fd => Fs.closeSync(fd));
        await pump(source, sut)
            .catch(() => {}); // Ignore errors in the main pipeline

        const reader = sut.createReadStream();
        const data = await StreamHelpers.pumpToString(reader)
            .catch(error => error);
        assert(data instanceof Error);
    })

    it('should serve readers if writer is destroyed', async () => {
        const sut = new ReadableFileWriter(AFileName);
        const closedPromise = new Promise<void>(resolve => sut.once('close', resolve));
        sut.write('abc');
        sut.destroy();
        await closedPromise;

        const reader = sut.createReadStream();
        const data = await StreamHelpers.pumpToString(reader);
        assert.equal(data, 'abc');
    })

    it('should propagate error from writer to active reader if writer is destroyed with error', async () => {
        const sut = new ReadableFileWriter(AFileName);
        sut.on('error', () => {});

        const reader = sut.createReadStream();
        const dataPromise = StreamHelpers.pumpToString(reader)
            .catch(error => error);

        sut.destroy(new Error('ERROR'));

        const data = await dataPromise;
        assert(data instanceof Error && data.message === 'ERROR');
    })

    it('should propagate error from writer to new readers if writer is destroyed with error', async () => {
        const sut = new ReadableFileWriter(AFileName);
        sut.on('error', () => {});
        sut.destroy(new Error('ERROR'));

        const reader = sut.createReadStream();
        const data = await StreamHelpers.pumpToString(reader)
            .catch(error => error);
        assert(data instanceof Error && data.message === 'ERROR');
    })

    it('should ignore errors in readers', async () => {
        const source = StreamHelpers.createReadable();
        const sut = new ReadableFileWriter(AFileName);
        const pumpPromise = pump(source, sut);

        const reader = sut.createReadStream();
        reader.on('error', () => {});
        reader.emit('error', new Error('ERROR'));

        source.push('DATA');
        source.push(null);
        await pumpPromise;
        assert.equal(readFile(AFileName), 'DATA');
    })

    it('should ignore destroyed readers', async () => {
        const source = StreamHelpers.createReadable();
        const sut = new ReadableFileWriter(AFileName);
        const pumpPromise = pump(source, sut);

        const reader = sut.createReadStream();
        (reader as any).destroy();

        source.push('DATA');
        source.push(null);
        await pumpPromise;
        assert.equal(readFile(AFileName), 'DATA');
    })

})

function readFile(path: string): string
{
    return Fs.readFileSync(path, { encoding: 'utf8' });
}

async function delay(ms: number): Promise<void>
{
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}
