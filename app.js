const express = require ('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
require('dotenv').config({ path: '\.env' });

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

// Mong URI
const mongoURI = process.env.MONGODB_URI;

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs, gridfsBucket;

// conn.once('open', () => {
//   gfs = Grid(conn.db, mongoose.mongo);
//   gfs.collection('uploads');
// })

conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
  bucketName: 'uploads'
});

  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
})

// Create Storage engine
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
          };
          resolve(fileInfo);
        });
      });
    }
  });
  const upload = multer({ storage });



// landing page
app.set('view engine', 'ejs');

// @route GET /
// @desc Loads form

app.get('/', (req,res) => {
  gfs.files.find().toArray((err, files) => {
    // check if files
    if(!files || files.length == 0){
      res.render('index', {files: false});
    } else {
      files.map(file => {
        if(file.contentType === 'image/jpeg' || file.contentType === 'image/png')
        {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render('index', {files: files})
    }
  });
})

// @route POST / upload
// @desc Uploads file to DB
app.post('/upload', upload.single('file'), ( req,res) => {
    // res.json({file: req.file})
    res.redirect("/");
})

// @routes GET /files
// @desc display all files in JSON
app.get('/files', (req,res) => {
  gfs.files.find().toArray((err, files) => {
    // check if files
    if(!files || files.length == 0){
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    // Files exist
    return res.json(files);
  });
})

// @routes GET /files/:filename
// @desc display single object in JSON
app.get('/files/:filename', (req,res) => {
  gfs.files.findOne({filename: req.params.filename}, (err, file) => {
    // check if file
    if(!file || file.length == 0){
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    //File exists
    return res.json(file);
  });
})

// @routes GET /image/:filename
// @desc display image
app.get('/image/:filename', (req,res) => {
  gfs.files.findOne({filename: req.params.filename}, (err, file) => {
    // check if file
    if(!file || file.length == 0){
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    // Check if image
    /* if(file.contentType === 'image/jpeg' || file.contentType === 'image/png'){
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    }  */
    if(file.contentType === 'image/jpeg' || file.contentType ==='image/png') {
      const readStream = gridfsBucket.openDownloadStreamByName(file.filename);
      readStream.pipe(res);
    }else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
})

// @route DELETE /files/:id
// @desc Delete file
app.deleteFileByFilename = async (req, res, next) => {
  const file = await gfs.files.findOne({ filename: req.params.filename });
  const gsfb = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
  gsfb.delete(file._id, function (err, gridStore) {
    if (err) return next(err);
    res.status(200).end();
  });
};

const port = 5000;

app.listen(port, () => console.log(`Server started on port ${port}`));