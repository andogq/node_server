// Imports
const imports = {
    http: require("http"),
    url: require("url"),
    fs: require("fs"),
    path: require("path")
}

// Globals
const mimeTypes = {
    "html": "text/html",
    "css": "text/css",
    "js": "text/js",
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg"
}

class Server {
    constructor({port, publicFolder, debug, api}) {
        // Set the globals and their defaults
        this.port = port == undefined ? 8080 : port;
        this.publicFolder = publicFolder == undefined ? "public" : publicFolder;
        this.debug = debug == undefined ? false : debug;
        this.api = api == undefined ? false : api;

        this.initialised = false;
        this.cache = {};

        // Setup the API
        if (this.api != false) {
            this.api.tip = this.api.tip == undefined ? "/api" : this.api.tip;
            // Handler function required
            if (this.api.handler == undefined) this.api = false;
        }

        this.init();
    }

    init() {
        if (!this.initialised) {
            if (this.debug) {
                this.log("Debug mode");
            }
        
            // Load the server
            this.log(`Starting on port ${this.port}`);
        
            const server = imports.http.createServer(this.incomingMessage.bind(this));
            server.listen(this.port);
        }
    }

    fetchFile(fileName) {
        return new Promise((resolve, reject) => {
            if (Object.keys(this.cache).indexOf(fileName) != -1 && !debug) {
                // Fetch file and mime from cache
                resolve(this.cache[fileName]);
            } else {
                // Resolve the path of the file
                let path = imports.path.resolve(this.publicFolder, fileName);
    
                // Read the contents of the file
                imports.fs.readFile(path, (err, file) => {
                    if (err) reject(err);
    
                    // Get mime type of file
                    let ext = imports.path.parse(path).ext.substr(1);
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
            let url = imports.url.parse(req.url);
            
            if (url.pathname == "/") url.pathname = "/index.html";

            if (url.pathname.indexOf(this.apiTip) == 0) {
                // Collect POST data
                let data = "";
                req.setEncoding("utf8");
                req.on("data", (chunk) => {data += chunk});
                req.on("end", () => {
                    // Make the API call
                    this.api({url: url.pathname.replace(globals.apiTip, ""), data, resolve, reject});
                });
            } else if (/^\/(?:\w+\/)*\w+\.\w+$/.test(url.pathname)) {
                let name = url.pathname == "/" ? "index.html" : url.pathname.substr(1);
                this.fetchFile(name).then(({file, mime}) => {
                    resolve({data: file, headers: {"Content-Type": mime}});
                }).catch(() => {reject(404)});
            } else reject(404);
        }).then((params) => {
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

    log(message, level) {
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