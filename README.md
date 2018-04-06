# readable-file-writer

A file writer that can also multicast data to multiple readers (Streams v2)

[![Build Status](https://travis-ci.org/sekogan/readable-file-writer.svg?branch=master)](https://travis-ci.org/sekogan/readable-file-writer) [![Coverage Status](https://coveralls.io/repos/github/sekogan/readable-file-writer/badge.svg?branch=master)](https://coveralls.io/github/sekogan/readable-file-writer?branch=master)

## Usage

```typescript
import { ReadableFileWriter } from 'readable-file-writer'
import request = require('request')
import express = require('express')

const app = express()
app.get('/', (req, res) => {
    // Stream a file from an HTTP server to disk
    const writer = new ReadableFileWriter('movie.mp4')
    request('http://foo.com/movie.mp4').pipe(writer)

    // Stream the file to the client at the same time
    writer.createReadStream().pipe(res)
})
app.listen(3000)
```

## API

```typescript
export interface Options
{
    bufferSize: number;
}

export interface ReadStreamOptions
{
    highWaterMark: number;
}

class ReadableFileWriter extends stream.Writable
{
    constructor(
        path: string,
        options?: Options
    );

    readonly path: string;

    createReadStream(
        options?: ReadStreamOptions
    ): NodeJS.ReadableStream;
}
```

### Options

`bufferSize` - total maximum amount of memory (in bytes) that can be used for buffering transferred data. Default value is 1MB.

The memory buffer contains last chunks of data that went through the writing pipeline.

Readers always try to read from the memory buffer first. If the memory buffer is big enough or the reading pipeline is fast enough the streaming is done completely from the memory buffer.

### ReadableFileWriter's events

- `open`
- `close`
- `error`

### ReadableFileWriter.createReadStream

Creates a readable stream. Readable streams can be created and used at any time, even if the writing pipeline is finished and the instance of ReadableFileWriter is destroyed.

Any number of readable streams can be created.

`highWaterMark` - this value is passed to all calls to `fs.createReadStream` that ReadableFileWriter makes under the hood during the streaming. Default value is 128KB.

### Error handling

Clients should listen to `error` events on the instance of ReadableFileWriter and listen to `error` events on all created readable streams.

ReadableFileWriter propagates errors from the writing pipeline to all reading pipelines. It allows clients to gracefuly stop reading pipelines without leaking resources.


## Installation

```
npm install readable-file-writer
```

or

```
yarn add readable-file-writer
```

An additional installation step is required if your project is written in Typescript. Typings for the `readable-stream` module are not installed automatically. You have to install them manually using either option 1 or 2:

- **Option 1**: install typings using npm or yarn. There is no standard `@types/readable-stream` right now but it may be added in the future;
- **Option 2**: manually add typings from this module to your `tsconfig.json`:

    ```json
    "include": [
        "./node_modules/readable-file-writer/types/readable-stream.d.ts"
    ]
    ```

---
Copyright &copy; 2018 Sergei Kogan.
Licensed under [The MIT license](LICENSE).
