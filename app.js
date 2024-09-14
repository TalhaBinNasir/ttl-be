const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
const cors = require("cors");
const stream = require("stream");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;

const googleCredentials = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  universe_domain: "googleapis.com",
};

const upload = multer({
  storage: multer.memoryStorage(),
});

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://www.trucktalklogistics.com",
      "http://www.trucktalklogistics.com",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Scopes for Google Drive API access
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Create a Google Drive client using the service account credentials
const auth = new google.auth.GoogleAuth({
  credentials: googleCredentials,
  scopes: SCOPES,
});

const drive = google.drive({ version: "v3", auth });

// File upload endpoint

app.post(
  "/upload",
  upload.fields([
    { name: "mcAuthority", maxCount: 1 },
    { name: "w9form", maxCount: 1 },
    { name: "noticeOfAssignment", maxCount: 1 },
    { name: "certificateInsurance", maxCount: 1 },
  ]),
  async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    try {
      const uploadPromises = [];

      for (const [fieldName, files] of Object.entries(req.files)) {
        files.forEach((file) => {
          // Convert Buffer to Readable Stream
          const bufferStream = new stream.PassThrough();
          bufferStream.end(file.buffer);

          const fileMetadata = {
            name: file.originalname,
            parents: ["1OgdC_oD3obouDOImQlA9f07-mUE_EQsk"], // Replace with your folder ID
          };

          const media = {
            mimeType: file.mimetype,
            body: bufferStream, // Use the stream
          };

          const uploadPromise = drive.files
            .create({
              resource: fileMetadata,
              media: media,
              fields: "id",
            })
            .then((fileResponse) => {
              console.log(
                `${file.originalname} uploaded successfully with ID: ${fileResponse.data.id}`
              );
              return {
                fieldName,
                fileId: fileResponse.data.id,
                message: `${file.originalname} uploaded successfully.`,
              };
            })
            .catch((error) => {
              console.error(`Error uploading ${file.originalname}:`, error);
              return {
                fieldName,
                message: `Failed to upload ${file.originalname}.`,
              };
            });

          uploadPromises.push(uploadPromise);
        });
      }

      const results = await Promise.all(uploadPromises);
      res.status(200).json({ success: true, results });
    } catch (error) {
      console.error("Error processing files", error);
      res.status(500).send("Failed to process files.");
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
