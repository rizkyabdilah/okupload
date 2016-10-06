/*
 * @author Rizky Abdilah <rizky@abdi.la>
 * @date Juni 2014
 * @last 20 Agustus 2015 / ?_=12
 * 
 * Library untuk mengupload file ke server
 * File yang diupload sedikit demi sedikit sesuai ukuran chunk_size
 * Proses:
 *  - POST request create new file, checksum (server)
 *  - jika nilai bytesWritten < ukuran file sebenarnya (yg di harddisk) lakukan proses upload
 *  - PATCH (POST) request, upload file, recursive sampai nilai bitesWritten == ukuran file
 * 
 * Terinspirasi dari:
 *  - resumable.js <https://github.com/23/resumable.js>
 *  - Resumable File Upload <http://tus.io/protocols/resumable-upload.html>
 *  - tus-jquery-client <https://github.com/tus/tus-jquery-client>
 *
 * Di rewrite menggunakan library mOxie <https://github.com/moxiecode/moxie>
 * <https://tools.ietf.org/html/rfc5789>.
 *
 */

var Uploader = (function(){
    Uploader = function(opts){
        var self = this;
        
        // just init
        self.userAgent = navigator.userAgent;
        self.bytesWritten = 0;
        self.stop = false;
        self.file = null;
        self.lastXhr = null;
        self.fileInfo = {};
        self.settings = {
            endpoint: null,
            browseButton: "file-picker",
            runtime: "html5,flash",
            chunkSize: 200 * 1024,
            uploadId: 0,
            timeout: 30 * 1000, // millisecond
            debug: true,
            referrer: "not-set.web",
            acceptedMimes: "video" // video|image,
        };
        
        for (k in opts){
            self.settings[k] = opts[k];
        }
        self.referrer = self.settings.referrer + " -- " + self.userAgent;
        
        self.masterPath = null;
        self.uploadId = null;
        self.uploadPath = self.settings.endpoint + "?uploadId=" + self.settings.uploadId;
        
        var acceptedMimes = [];
        var mimes = self.settings.acceptedMimes.split(",");
        for (var i = 0; i < mimes.length; i++) {
            var mime = mimes[i].trim() + "/*";
            acceptedMimes.push(mime);
        }
        
        var fileInput = new mOxie.FileInput({
            browse_button: self.settings.browseButton,
            runtime_order: self.settings.runtime,
            accept: acceptedMimes.join(","),
        });

        fileInput.onchange = function(e) {
            self.parseFiles(e.target.files);
            if (self._validFile()) {
                self.beforeUpload();
                self.start();
            } else{
                var err_msg = "Invalid file, accepted file is " + mimes.join(", ");
                self.emitInvalidFile(err_msg);
            }
        };

        fileInput.init();
    };

    Uploader.prototype._validFile = function(){
        var self = this;
        var mimes = self.settings.acceptedMimes.split(",");
        for (var i = 0; i < mimes.length; i++) {
            var mime = mimes[i].trim();
            if (self.fileInfo.contentType.substring(0, mime.length) == mime) {
                return true;
            }
        }
        return false;
    };
    
    Uploader.prototype.parseFiles = function(files){
        var self = this;
        self.file = files[0];
        self.fileInfo.fileName = self.file.name;
        self.fileInfo.fileSize = self.file.size;
        self.fileInfo.contentType = self.file.type;
    };
    
    Uploader.prototype._getHeader = function(xhr, k){
        var _ = xhr.getResponseHeader(k);
        if (_) {
            _ = _.replace(k + ":", "").trim();
        }
        return _;
    };
    
    Uploader.prototype._removeHtml = function(txt){
        return txt.replace(/<(?:.|\n)*?>/gm, '');
    };
    
    Uploader.prototype.getUploadPath = function(args){
        return this.uploadPath + "&" + args.join("&");
    };
    
    Uploader.prototype.log = function(msg){
        self = this;
        if (window.console && self.settings.debug === true) {
            console.log(msg);
        }
    };
    
    Uploader.prototype.start = function(){
        var self = this;
        self.stop = false;
        
        // fokking callback, thats why nodejs sux :p
        // or I just sux at writting callback function :(
        var _patchCallback = function(xhr){
            self.bytesWritten = parseInt(xhr.resp.bytes_written);
            self.log("New bytesWritten: " + self.bytesWritten);
            self.updateProgress();
            
            if (!self.isUploadComplete() && self.stop == false) {
                self.patch({success: _patchCallback});
            }
        };
        
        var _postCallback = function(xhr){
            self.filePath = xhr.resp.file_path;
            self.uploadId = xhr.resp.upload_id;
            self.uploadPath = self.settings.endpoint + "?uploadId=" + self.uploadId;
            self.bytesWritten = parseInt(xhr.resp.bytes_written);
            self.updateProgress();
            
            if (!self.isUploadComplete()) {
                self.patch({success: _patchCallback});
            }
        };
        // end fokking callback
        self.log("Starting post data");
        self.post({success: _postCallback});
        
        return true;
    };
    
    Uploader.prototype.stopUpload = function(){
        var self = this;
        self.stop = true;
        self.emitStop();
        return true;
    };

    Uploader.prototype.post = function(opts){
        var self = this;
        var xhr = new mOxie.XMLHttpRequest();
        xhr.timeout = self.settings.timeout;
        xhr.open("POST", self.getUploadPath(["mode=init"]));
        self.log("POST: " + self.getUploadPath(["mode=init"]));
        xhr.onloadend = function(){
            self.lastXhr = xhr;
            if (opts && xhr.status == 200 && opts.success) {
                xhr.resp = JSON.parse(self._removeHtml(xhr.responseText));
                opts.success(xhr);
            }
            
            if (xhr.status != 200) {
                self.emitFail("Failed to POST UID: " + self.settings.uploadId);
            }
            this.destroy();
            xhr = null;
        };
        
        var data = new mOxie.FormData();
        data.append("file_name", self.fileInfo.fileName);
        data.append("file_size", self.fileInfo.fileSize);
        data.append("content_type", self.fileInfo.contentType);
        data.append("referrer", self.referrer);
        
        self.log("file_name = " + self.fileInfo.fileName);
        self.log("file_size = " + self.fileInfo.fileSize);
        self.log("content_type = " + self.fileInfo.contentType);
        self.log("referrer = " + self.referrer);
        
        xhr.send(data, {runtime_order: self.settings.runtime});
    };
    
    Uploader.prototype.patch = function(opts){
        var self = this;
        var xhr = new mOxie.XMLHttpRequest();
        xhr.timeout = self.settings.timeout;
        xhr.open("POST", self.getUploadPath(["mode=patch"]));
        self.log("POST: " + self.getUploadPath(["mode=patch"]));
        xhr.onloadend = function(){
            self.lastXhr = xhr;
            if (opts && xhr.status == 200 && opts.success) {
                xhr.resp = JSON.parse(self._removeHtml(xhr.responseText));
                opts.success(xhr);
            }
            
            if (xhr.status != 200) {
                var msg = "Failed to PATCH UID: " + self.settings.uploadId;
                msg += "\nbytes: " + self.bytesWritten;
                self.emitFail(msg);
            }
            this.destroy();
            xhr = null;
        };
        
        var rangeFrom = self.bytesWritten;
        var rangeTo = rangeFrom + self.settings.chunkSize;
        if (rangeTo > self.fileInfo.fileSize) {
            rangeTo = self.fileInfo.fileSize;
        }
        
        self.log("Offset = " + rangeFrom + " --> " + rangeTo);
        var data = self.file.slice(rangeFrom, rangeTo);
        xhr.setRequestHeader("Offset", rangeFrom);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(data, {runtime_order: self.settings.runtime});
    };
    
    Uploader.prototype.isUploadComplete = function(){
        var self = this;
        return self.bytesWritten >= self.fileInfo.fileSize;
    };

    Uploader.prototype.updateProgress = function(){
        var self = this;
        var prc = Math.ceil(self.bytesWritten / self.fileInfo.fileSize * 100);
        if (prc > 100 || self.bytesWritten == self.fileInfo.fileSize) {
            prc = 100;
        }
        
        self.emitProgress(prc);
        if (self.isUploadComplete()) {
            self.emitDone();
        }
    };

    Uploader.prototype.beforeUpload = function(){
        var self = this;
        if (self.settings.beforeUpload){
            self.settings.beforeUpload();
        }
    };
    
    Uploader.prototype.emitProgress = function(prc){
        var self = this;
        if (self.settings.progress){
            self.settings.progress(prc);
        }
    };
    
    Uploader.prototype.emitStop = function(){
        var self = this;
        self.log("Stop uploading, bytesWritten: " + self.bytesWritten);
        if (self.settings.stop){
            self.settings.stop(self);
        }
    };

    Uploader.prototype.emitDone = function(){
        var self = this;
        self.log("Done uploading: " + self.uploadId);
        if (self.settings.done){
            self.settings.done(self);
        }
    };

    Uploader.prototype.emitFail = function(msg){
        var self = this;
        if (self.settings.fail){
            self.settings.fail(msg);
        }
        self.log(msg);
    };

    Uploader.prototype.emitInvalidFile = function(msg){
        var self = this;
        if (self.settings.invalidFile){
            self.settings.invalidFile(msg);
        }
        self.log(msg);
    };
    
    return Uploader;
})();

// end file
