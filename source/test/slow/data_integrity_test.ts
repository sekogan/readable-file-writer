import { ReadableFileWriter } from '../../lib/readable_file_writer';
import StreamHelpers = require('../helpers/streams');
import WorkingDir = require('../helpers/working_dir');
import { asyncPump as pump } from '../helpers/async_pump';
import Generatorics = require('generatorics');
import Path = require('path');
import Fs = require('fs');
import assert = require('assert');

const AFileName = Path.join(WorkingDir.path, 'foo');
const TestStreamSize = 1*1000*1000 + 5669;
const TestChunkSize = 8*1000;

const DataSources = [
    {
        name: 'slow',
        factory: () => createTestDataSource(StreamHelpers.Delays.big),
    },
    {
        name: 'fast',
        factory: () => createTestDataSource(StreamHelpers.Delays.none),
    },
    {
        name: 'random',
        factory: () => createTestDataSource(StreamHelpers.Delays.random),
    },
];

const DataConsumers = [
    {
        name: 'slow',
        factory: () => StreamHelpers.createNullWritable(StreamHelpers.Delays.big),
    },
    {
        name: 'fast',
        factory: () => StreamHelpers.createNullWritable(StreamHelpers.Delays.none),
    },
    {
        name: 'random',
        factory: () => StreamHelpers.createNullWritable(StreamHelpers.Delays.random),
    },
];

const NumberOfConsumers = [ 1, 2 ];

function* generateTestCases()
{
    for (const numberOfConsumers of NumberOfConsumers)
        yield* Generatorics.cartesian(
            DataSources,
            Array.from(Generatorics.clone.combination(
                DataConsumers, numberOfConsumers
            ))
        );
}

describe('data integrity', function () {
    this.timeout(30000);

    beforeEach(WorkingDir.create)
    afterEach(WorkingDir.remove)

    for (const testCase of generateTestCases())
    {
        const [ source, consumers ] = testCase;

        it(`${source.name} source -> [ ${ consumers.map(x => x.name).join(', ') } ] consumers`, async () => {
            const sut = new ReadableFileWriter(AFileName, {
                bufferSize: 64*1024,
            });
            const sourceStream = await source.factory();
            let inputHash;
            const pumps = [
                pump(
                    sourceStream,
                    StreamHelpers.throughMd5Calculator(hash => inputHash = hash),
                    sut,
                )
            ];

            const outputHashes: Map<string, string> = new Map;
            for (const consumer of consumers)
            {
                const consumerStream = consumer.factory();
                pumps.push(
                    pump(
                        sut.createReadStream(),
                        StreamHelpers.throughMd5Calculator(hash => outputHashes.set(consumer.name, hash)),
                        consumerStream,
                    )
                )
            }

            await Promise.all(pumps);

            let fileHash;
            await pump(
                Fs.createReadStream(AFileName),
                StreamHelpers.throughMd5Calculator(hash => fileHash = hash),
                StreamHelpers.createNullWritable(),
            );

            assert.equal(fileHash, inputHash, 'File hash should be equal to input hash');
            assert.equal(outputHashes.size, consumers.length);
            for (const [ consumerName, outputHash ] of outputHashes)
                assert.equal(outputHash, inputHash, `Hash of data of ${consumerName} consumer should be equal to input hash`);
        })
    }

})

function createTestDataSource(delays: () => number)
{
    return StreamHelpers.createRandomDataSource({
        size: TestStreamSize,
        chunkSize: TestChunkSize,
        delays,
    });
}
