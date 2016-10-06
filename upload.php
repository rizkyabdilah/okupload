<?php
ini_set('display_errors', 'on');
error_reporting(E_ALL);
include_once('FileUpload.php');

$method = $_SERVER['REQUEST_METHOD'];
$mode = $_GET['mode'];
$uploadId = $_GET['uploadId'];
$uploadPath = dirname(__FILE__) . '/uploads';

$FU = new FileUpload($uploadId, $uploadPath);

if ($mode == 'init'){
    $filename = $_POST['file_name'];
    $contentType = $_POST['content_type'];
    $filesize = $_POST['file_size'];
    $referrer = $_POST['referrer'];
    $FU->setMetadata($filename, $contentType, $filesize, $referrer);
} elseif ($mode == 'patch'){
    $entityBody = fopen('php://input', 'r');
    $FU->patchFile($entityBody);
}

$filePath = $FU->getFilePath();
$filePath = str_replace(dirname(__FILE__), '', $filePath);

$resp = array(
    'status' => 1,
    'file_path' => $filePath,
    'upload_id' => $FU->uploadId,
    'bytes_written' => $FU->writtenSize(),
    'bytes_expect' => $FU->metadata['filesize'],
    'referrer' => $FU->metadata['referrer'],
);

print json_encode($resp);
