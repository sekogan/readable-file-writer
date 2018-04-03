import Tests = require('./tests');
import WorkingDir = require('../helpers/working_dir');

async function main()
{
    try
    {
        await WorkingDir.create();

        // Run the test once without measuring to warm up everything
        Tests.testNodeFileWriter();

        console.log(`Copying ${Tests.TestStreamSize} bytes through node's FileWriter`);
        console.time('OK');
        Tests.testNodeFileWriter();
        console.timeEnd('OK');

        console.log(`Copying ${Tests.TestStreamSize} bytes through ReadableFileWriter`);
        console.time('OK');
        Tests.testReadableFileWriter();
        console.timeEnd('OK');
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
