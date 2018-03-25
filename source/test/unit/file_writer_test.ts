import ReadableFileWriter from '../../lib/readable_file_writer';
import * as WorkingDir from '../helpers/working_dir';
import * as Stream from 'readable-stream';
import * as Fs from 'fs-extra';
import * as Path from 'path';
import assert = require('assert');

const AFileName = Path.join(WorkingDir.path, 'foo');

const TestCases = [
    {
        name: 'ReadableFileWriter',
        factory: (path: string) => new ReadableFileWriter(path),
    },
    {
        name: 'Fs.WriteStream',
        factory: (path: string) => Fs.createWriteStream(path),
    },
];

for (const testCase of TestCases)
{
    describe(`${testCase.name} as file writer`, () => {
        const createSut = testCase.factory;

        beforeEach(WorkingDir.create)
        afterEach(WorkingDir.remove)
        
        it('should emit "close" event if auto closed', done => {
            const sut = createSut(AFileName);
            sut.on('close', done);
            sut.end();
        })

        it('should emit "close" event if destroyed', done => {
            const sut = createSut(AFileName);
            sut.on('close', done);
            sut.destroy();
        })

        it('should emit "finish" event on the end of the data', done => {
            const sut = createSut(AFileName);
            sut.on('finish', done);
            sut.end();
        })

        it('should emit "open" event', done => {
            const sut = createSut(AFileName);
            sut.on('open', fd => {
                assert.equal(typeof fd, 'number');
                done();
            });
            sut.end();
        })

        it('should write to file', done => {
            const sut = createSut(AFileName);
            sut.on('error', done);
            sut.on('finish', () => {
                assert.equal(readFile(AFileName), 'abc');
                done();
            });
            sut.end(Buffer.from('abc'));
        })

        it('should write chunks in correct order', done => {
            const sut = createSut(AFileName);
            sut.on('error', done);
            sut.on('finish', () => {
                assert.equal(readFile(AFileName), 'abcdef');
                done();
            })
            sut.write(Buffer.from('abc'));
            sut.write(Buffer.from('def'));
            sut.end();
        })

        it('should create empty file if no data is written', done => {
            const sut = createSut(AFileName);
            sut.on('error', done);
            sut.on('close', () => {
                assert.equal(readFile(AFileName), '');
                done();
            })
            sut.end();
        })

        it('should be pipeable with source stream', done => {
            const source = new Stream.Readable;

            const sut = createSut(AFileName);
            sut.on('error', done);
            sut.on('finish', () => {
                assert.equal(readFile(AFileName), 'abc');
                done();
            });

            source.pipe(sut);
            source.push('abc');
            source.push(null);
        })

        it('should emit error if file cannot be opened', done => {
            Fs.mkdirSync(AFileName);
            const sut = createSut(AFileName);
            sut.on('error', error => {
                assert.equal(error.code, 'EISDIR');
                done();
            });
        })

        it('should emit error if chunk cannot be written', done => {
            const sut = createSut(AFileName);
            sut.on('error', () => {});
            sut.on('open', fd => {
                Fs.closeSync(fd);
                sut.once('error', () => done());
            });
            sut.write(Buffer.from('abc'));
        })

        it('should emit error if file cannot be closed', done => {
            const sut = createSut(AFileName);
            sut.on('error', () => {});
            sut.on('open', fd => {
                sut.write(Buffer.from('abc'), (error?: Error) => {
                    assert(!error);
                    Fs.closeSync(fd);
                    sut.once('error', () => done());
                    sut.end();
                });
            });
        })

        it('should emit error is writer is destroyed with error', done => {
            const sut = createSut(AFileName);
            sut.once('error', error => {
                assert.equal(error.message, 'FOO');
                done();
            });
            sut.destroy(new Error('FOO'));
        })

    })
}

function readFile(path: string): string
{
    return Fs.readFileSync(path, { encoding: 'utf8' });
}
