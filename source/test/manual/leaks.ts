import * as WorkingDir from '../helpers/working_dir';
import * as Tests from './tests';
import Heapdump = require('heapdump');

async function main()
{
    try
    {
        const NumberOfIterations = 100;

        await WorkingDir.create();

        console.log('Warming up...');
        await Tests.testReadableFileWriter();

        console.log('Writing first heapdump...')
        Heapdump.writeSnapshot(`${NumberOfIterations}_1.heapsnapshot`, ()=>{});

        console.log('Testing...')
        for (let i = 0; i < NumberOfIterations; i++)
            await Tests.testReadableFileWriter();

        console.log('Writing second heapdump...')
        Heapdump.writeSnapshot(`${NumberOfIterations}_2.heapsnapshot`, ()=>{});

        console.log('Testing...')
        for (let i = 0; i < NumberOfIterations; i++)
            await Tests.testReadableFileWriter();

        console.log('Writing third heapdump...')
        Heapdump.writeSnapshot(`${NumberOfIterations}_3.heapsnapshot`, ()=>{});

        console.log('Done');
    }
    finally
    {
        await WorkingDir.remove();
    }
}

main().catch(error => {
    console.error(error.stack);
    process.exit(1);
});
