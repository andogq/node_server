// Imports
let http = require("http");
let url = require("url");
let fs = require("fs");
let path = require("path");

// Globals
const mimeTypes = {
    "html": "text/html",
    "css": "text/css",
    "js": "text/js",
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg"
}

interface ApiHandlerParameters {
    url: string,
    data: string,
    ip: string
}

interface ServerApi {
    tip: string,
    handler: (params: ApiHandlerParameters) => {statusCode: number, data: string, headers}
}

interface ServerOptions {
    port: number,
    publicFolder: string,
    api?: ServerApi,
    debug: boolean
}

class Server {
    initialised: boolean;
    cache: object;

    // Supplied by the user
    port: number;
    publicFolder: string;
    api?: ServerApi;
    debug: boolean;

    constructor({port = 8080, publicFolder = "public", api, debug = false}: ServerOptions) {
        // Set the globals and their defaults
        this.port = port;
        this.publicFolder = publicFolder;
        this.debug = debug;
        this.api = api;

        this.initialised = false;
        this.cache = {};

        this.init();
    }

    init() {
        if (!this.initialised) {
            if (this.debug) {
                this.log("Debug mode");
            }
        
            // Load the server
            this.log(`Starting on port ${this.port}`);
        
            const server = http.createServer(this.incomingMessage.bind(this));
            server.listen(this.port);
        }
    }

    fetchFile(fileName) {
        return new Promise((resolve, reject) => {
            if (Object.keys(this.cache).indexOf(fileName) != -1 && !this.debug) {
                // Fetch file and mime from cache
                resolve(this.cache[fileName]);
            } else {
                // Resolve the path of the file
                let filePath = path.resolve(this.publicFolder, fileName);
    
                // Read the contents of the file
                fs.readFile(filePath, (err, file) => {
                    if (err) reject(err);
    
                    // Get mime type of file
                    let ext = path.parse(filePath).ext.substr(1);
                    let mime = mimeTypes[ext];
                    mime = mime == undefined ? "text/plain" : mime;
    
                    // Add the file and mime to the cache
                    this.cache[fileName] = {file, mime};
    
                    // Resolve the contents and mimeType
                    resolve({file, mime});
                });
            }
        });
    }

    incomingMessage(req, res) {
        // Asynchronously fetch the file
        new Promise((resolve, reject) => {
            // Parse the url
            let reqUrl = url.parse(req.url);
            
            if (reqUrl.pathname == "/") reqUrl.pathname = "/index.html";

            if (this.api && reqUrl.pathname.indexOf(this.api.tip) == 0 && req.method == "POST") {
                // Collect POST data
                let data = "";
                req.setEncoding("utf8");
                req.on("data", (chunk) => {data += chunk});
                req.on("end", () => {
                    try {
                        data = JSON.parse(data);
                    } catch(e) {
                        data = ""
                    }
                    // Make the API call
                    this.api.handler({
                        url: reqUrl.pathname.replace(this.api.tip, ""),
                        data,
                        ip: req.headers["x-real-ip"] || req.connection.remoteAddress,
                        resolve,
                        reject
                    });
                });
            } else if (/^\/(?:\w+\/)*\w+\.\w+$/.test(reqUrl.pathname)) {
                let name = reqUrl.pathname.substr(1);
                this.fetchFile(name).then(({file, mime}) => {
                    resolve({data: file, headers: {"Content-Type": mime}});
                }).catch(() => {reject(404)});
            } else reject(404);
        }).then((params: {data: string, headers?: string[]}) => {
            let {data, headers} = params == undefined ? {data: "", headers: undefined} : params;
            this.log([200, req.url].join(" "));
            
            // Set status code and headers
            res.statusCode = 200;
            if (headers != undefined) {
                Object.keys(headers).forEach((header) => {
                    res.setHeader(header, headers[header]);
                });
            }

            res.end(data);
        }).catch((err) => {
            // Log and close the connection due to an error
            this.log([err, req.url].join(" "), -1);

            res.statusCode = err != undefined || +err == NaN ? err : 500;
            res.end();
        });
    }

    log(message: string, level? : number = 0) {
        let symbol;
        switch (level) {
            case 0:
                symbol = "+";
                break;
            case 1:
                symbol = "!";
                break;
            case -1:
                symbol = "-";
                break;
            default:
                symbol = "+";
                break;
        }
        console.log(`[${symbol}] Server | ${message}`);
    }
}

module.exports = Server;