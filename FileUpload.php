<?php
class FileUpload {

    public $uploadId = 0;
    public $metadata = array();
    private $uploadPath;
    private $sumKey;
    private $ext;
    private $bufferSize = 8092; // 8kB

    function __construct($uploadId, $uploadPath){
        $this->uploadId = $uploadId;
        $this->uploadPath = $uploadPath;

        if ($this->uploadId != 0){
            $this->sumKey = $this->uploadId;
            $this->preUpload();
        }
    }

    function setBufferSize($bufferSize){
        $this->bufferSize = $bufferSize;
    }

    function getBucketPath(){
        return $this->uploadPath . '/' . substr($this->sumKey, 0, 2);
    }

    function getFilePath(){
        return $this->getBucketPath() . '/' . $this->sumKey . '.' . $this->ext;
    }

    function generateSumKey(){
        return sha1($this->metadata['filename'] . $this->metadata['content_type'] . $this->metadata['filesize']);
    }

    function metadataPath(){
        return $this->getBucketPath() . '/' . $this->sumKey . '.info';
    }

    function writtenSize(){
        return filesize($this->getFilePath());
    }

    function isUploadComplete(){
        return $this->metadata['file_size'] === $this->writtenSize();
    }

    function preUpload(){
        if (count($this->metadata) == 0){
            $metadata = file_get_contents($this->metadataPath());
            $this->metadata = json_decode($metadata, true);
            $this->ext = pathinfo($this->metadata['filename'], PATHINFO_EXTENSION);
        }

        if (!file_exists($this->getFilePath())){
            touch($this->getFilePath());
        }
    }

    function postUpload(){
        // can be overriden
    }

    function setMetadata($filename, $contentType, $filesize, $referrer){
        $this->metadata = array(
            'filename' => $filename,
            'content_type' => $contentType,
            'filesize' => intval($filesize),
            'referrer' => $referrer,
        );
        $this->sumKey = $this->generateSumKey();
        if ($this->uploadId == 0){
            $this->uploadId = $this->sumKey;
        }

        $this->ext = pathinfo($filename, PATHINFO_EXTENSION);

        if (!file_exists($this->getBucketPath())){
            mkdir($this->getBucketPath(), 0777, true);
        }

        $mf = fopen($this->metadataPath(), 'w');
        $content_mf = json_encode($this->metadata);
        fwrite($mf, $content_mf);
        fclose($mf);

        $this->preUpload();
    }

    function patchFile($streamInput){
        $fp = fopen($this->getFilePath(), 'a');
        fseek($fp, $this->writtenSize());
        $size = 0;
        while (!feof($streamInput)){
            $size += fwrite($fp, fread($streamInput, $this->bufferSize));
        }

        fclose($fp);
        return $size;
    }
}
