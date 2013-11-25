// -*- js2-basic-offset: 4; javascript-basic-offset: 4 -*-
/*global require, console, setTimeout */

var http = require('http');
var https = require('https');
var util = require('util');
var path = require('path');
var url = require('url');
var fs = require('fs');

var colors = require('colors');
var argv = require('optimist')
        .usage("Stress test an HTTP server.\nUsage: $0 [options] [target server]")
        .options('conf', { alias: 'config', describe: 'Configuration file with targets' })
        .options('target', { alias: 't', describe: 'Target server name in config file' })
        .options('c', { describe: 'Number of concurrent requests. Default: 20' })
        .options('n', { describe: 'Max number of total requests. Default: 200' })
        .options('o', { describe: 'Output format: [text|json]. Default: text' })
        .boolean('v', { alias: "verbose", describe: 'Verbose output' })
        .boolean('dry-run', { describe: "Read config, but don't run (can be used with -v)" })
        .boolean('help', { alias: 'h', describe: 'Print this usage and exit' })
        .argv;

function usage(noexit){
    console.log(require('optimist').help());
    if(!noexit) process.exit();
}

argv.h && usage();


/*********** CONFIGURATION  *************/
var defaults = {
    concurrency: 20,
    max_requests: 200,
    output_format: 'text' // 'text' or 'json'
};

var options = {};

var config_path;
if( argv.conf ){
    config_path = path.resolve(argv.conf);
    if(!fs.existsSync(config_path)){
        console.error("Configuration file not found: ", config_path);
        process.exit(-1);
    }
    options = require(config_path);
}

// Specify which config to use
var target = options.targets && options.targets[argv.target || argv.t];

// allow overriding/setting target options on the commandline
if(argv._[0]){
    target = url.parse(argv._[0]);
}

// establish concurrency settings
var concurrency = argv.c || (options.settings && options.settings.concurrency) || defaults.concurrency;
var max_requests = argv.n || (options.settings && options.settings.max_requests) || defaults.max_requests;
var global_output_format = argv.o || (options.settings && options.settings.output_format) || defaults.output_format;

/********** END CONFIGURATION  ***********/


if( argv.v ){
    console.log("config file:", config_path);
    console.log("options:", util.inspect(options));
    console.log("target:", util.inspect(target));
    console.log("concurrency:", concurrency);
    console.log("max_requests:", max_requests);
    console.log("output_format:", global_output_format);
    console.log("");
}

if(!target){
    console.error("Error: No target specified\n");
    console.error("Available targets are:");
    if( options.targets ){
        for(var t in options.targets){
            console.error("->", t);
        }
    }
    console.error("");
    usage(true);
    process.exit(1);
}

if( argv['dry-run'] ){
    process.exit();
}

http.globalAgent.maxSockets = https.globalAgent.maxSockets = concurrency+5;

var http_get = http.get;
if(target.port == 443 || (target.protocol && target.protocol.indexOf('https') > -1)){
    http_get = https.get;
}


var total_requests = 0;
var requests = 0;
var response_count = 1;

var stats = {
    statuses: {},
    min: 99999999999,
    max: -1,
    avg: -1,
    count: 0,
    rate: 0,
    start: false
};

stats.start = stats.start || new Date().getTime();
var updateStats = function(time, status){
    stats.statuses[status] = stats.statuses[status] || 0;
    stats.statuses[status]++;

    if( time < stats.min ) stats.min = time;
    if( time > stats.max ) stats.max = time;
    stats.avg = (stats.avg*stats.count + time)/++stats.count;
    stats.rate = stats.count / (new Date().getTime() - stats.start) * 1000; // per sec
};

var log_request = function(r, format){
    format = format || global_output_format || 'text';

    var output;
    if(format === 'json'){
        output = JSON.stringify(r);
    } else {
        var status_color = r.status == 200 ? "green" : "red";
        output = util.format("[%s] %s /%s time: %s (%s)",
                             r.status.toString()[status_color],
                             r.response_count,
                             r.request_id,
                             r.client_time.toString().blue,
                             r.server_time.toString().yellow);
    }
    console.log(output);
};

var makeCall = function(done, req_id){
    // console.log("making call");

    var start = new Date().getTime();

    http_get(target, function(res) {
        res.on('data', function(){/*Do nothing. Consume data so the connection ends.*/});
        res.on('end', function(){
            var client_time = new Date().getTime() - start;
            var status = res.statusCode;

            // show server-compute time if server reports it
            function get_server_time(res){
                if(res.headers["x-response-time"]) return res.headers["x-response-time"];
                if(res.headers["x-runtime"]) return Math.floor(res.headers["x-runtime"]*1000);
                return -1;
            }
            var server_time = get_server_time(res);

            //console.error(util.inspect(res.headers));

            var r = {
                status: status,
                request_id: req_id,
                response_count: response_count++,
                client_time: client_time,
                server_time: server_time
            };

            log_request(r);

            done(client_time, status);
        });
    }).on('error', function(e) {
        var time = new Date().getTime() - start;
        console.log("Got error: " + e.message);
        done(time, 0);
    });
};

function go(){
    if( requests < concurrency ){
        //console.log("requests: ", requests);
        //console.log("total_requests: ", total_requests);

        if( total_requests >= max_requests ){
            // console.log("=== done sending requests! ===");
            return;
        }

        makeCall(function(time, status){
            updateStats(time, status);
            requests--;

            if( requests == 0 && total_requests >= max_requests ){
                console.log("stats:");
                stats.total_time = new Date().getTime() - stats.start;
                console.log(util.inspect(stats));
            }

            go();
        }, total_requests);

        requests++;
        total_requests++;
    } else {
        console.log("too busy");
    }
}

log_request({status: "status", response_count: "response#",
             request_id: "request_id",
             client_time: "client time (ms)",
             server_time: "server time (ms)"});


// seed the right amount of requests
for(var i = 0; i < concurrency; i++){
    go();
}
