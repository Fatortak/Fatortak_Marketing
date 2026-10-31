<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: image/png');
header('Cache-Control: public, max-age=300');
readfile(__DIR__ . '/avatar.png');
