# Node HTTP Server Performance Tool

http-perf is a tool used to test HTTP/S server performance. It is basically an HTTP client that executes specified requests against a server and then measures and records response times and other metrics.

Its function is similar to the popular [ab](http://httpd.apache.org/docs/2.0/programs/ab.html) tool, and in fact the basic usage is identical. However, this tool goes above what `ab` provides for my needs. For example, it parses the server-side request time (if reported in headers) and displays it along with the client's view of request time for each request. It can also output its data in JSON.

## Install

via `npm`, preferrably globally (-g)

    $ npm install -g http-perf

This installs an executable called `nperf`.

You can run the tool directly

    $ node node_modules/http-perf/bin/nperf

Or if installed globally

    $ nperf


## Quick Start

Send 10 requests to google.com with 5 concurrent requests:

    $ nperf -c 5 -n 10 http://www.google.com/
    [status] response# /request_id time: client time (ms) (server time (ms))
    [200] 1 /1 time: 78 (-1)
    [200] 2 /0 time: 89 (-1)
    [200] 3 /3 time: 86 (-1)
    [200] 4 /4 time: 88 (-1)
    [200] 5 /2 time: 91 (-1)
    [200] 6 /6 time: 76 (-1)
    [200] 7 /5 time: 82 (-1)
    [200] 8 /7 time: 82 (-1)
    [200] 9 /9 time: 82 (-1)
    [200] 10 /8 time: 100 (-1)
    stats:
    { min: 76,
      max: 100,
      avg: 85.4,
      count: 10,
      rate: 50.76142131979695,
      start: 1337831509423,
      total_time: 197 }
    
We see that 10 requests were sent to the server with the average response time being 85.4 ms. The server processed requests at a rate of about 50 requests per second.

Server processing time is not available (-1) because Google does not return it in a header. Supported headers are: _X-Response-Time_ and _X-Runtime_.

## Usage

Display usage:

    $ nperf -h
    Stress test an HTTP server.
    Usage: node ./bin/nperf [options] [target server]
    
    Options:
      --conf, --config  Configuration file with targets                 
      --target, -t      Target server name in config file               
      -c                Number of concurrent requests                   
      -n                Max number of total requests                    
      -o                Output format: [text|json]. Default: text       
      -v, --verbose     Verbose output                                  
      --dry-run         Read config, but don't run (can be used with -v)
      --help, -h        Print this usage and exit 


One useful feature of the tool is that you can save all parameters and server targets in a config file and refer to it instead of specifying them on the commandline. All parameters specified on the commandline override their counterparts in the config file.

Sample config file `config.js`:

    module.exports = {
        settings: {
            concurrency: 10,  // -c
            max_requests: 200,  // -n
            output_format: 'text' // -o 'text' or 'json'
        },
        targets: {
            // can have multiple targets here
            // pick one using the --target commandline argument
            local: {
                host: 'localhost',
                port: 8080,
                path: '/path/to/http/resource',
                headers: {  
                    'X-Optional-Header': "header value"
                }
            },
            google: {
                host: 'www.google.com',
                port: 80,
                path: '/'
            }
        }
    };

Set the port to `443` for HTTPS.

To use the config file and specify the `google` target, run:

    $ nperf --conf config.js -t google
    [status] response# /request_id time: client time (ms) (server time (ms))
    [200] 1 /1 time: 161 (-1)
    [200] 2 /3 time: 164 (-1)
    [200] 3 /6 time: 165 (-1)
     ... output truncated ...
    [200] 198 /198 time: 67 (-1)
    [200] 199 /197 time: 81 (-1)
    [200] 200 /199 time: 71 (-1)
    stats:
    { min: 43,
      max: 722,
      avg: 110.34500000000004,
      count: 200,
      rate: 88.65248226950355,
      start: 1337832532680,
      total_time: 2256 }

The number of requests and concurrency values are taken from the config file, as well as the details for the `google` target. Output above is truncated for brevity.


## More examples

Override config with commandline parameters:

    $ nperf --config config.js --target google -c 1 -n 20

JSON output:

    $ nperf -o json http://www.google.com -n 5
    {"status":"status","response_count":"response#","request_id":"request_id","client_time":"client time (ms)","server_time":"server time (ms)"}
    {"status":200,"request_id":2,"response_count":1,"client_time":467,"server_time":-1}
    {"status":200,"request_id":0,"response_count":2,"client_time":475,"server_time":-1}
    {"status":200,"request_id":4,"response_count":3,"client_time":475,"server_time":-1}
    {"status":200,"request_id":1,"response_count":4,"client_time":477,"server_time":-1}
    {"status":200,"request_id":3,"response_count":5,"client_time":486,"server_time":-1}
    stats:
    { min: 467,
      max: 486,
      avg: 476,
      count: 5,
      rate: 10.101010101010102,
      start: 1337833296687,
      total_time: 495 }


## Contributing

I welcome pull requests!

## License

This software is distributed under the MIT License.
