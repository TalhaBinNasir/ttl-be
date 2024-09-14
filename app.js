const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
const cors = require("cors");
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
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./uploads");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
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
    console.log(req.files); // Log to check uploaded files

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    try {
      // Set to keep track of processed file paths
      const processedFiles = new Set();

      // Prepare an array to hold file upload promises
      const uploadPromises = [];

      // Iterate over each field and its files
      for (const [fieldName, files] of Object.entries(req.files)) {
        files.forEach((file) => {
          if (!file || !file.path) {
            console.error(
              `File path is missing for ${file?.originalname || "unknown file"}`
            );
            return; // Skip this file if no path is found
          }

          // Check if the file is a duplicate (based on file path or file name)
          if (processedFiles.has(file.path)) {
            console.log(`Skipping duplicate file: ${file.originalname}`);
            return; // Skip duplicate file
          }

          // Add file path to the set of processed files
          processedFiles.add(file.path);

          console.log(
            `Uploading file: ${file.originalname} with path: ${file.path}`
          );

          // Prepare metadata and media for Google Drive
          const fileMetadata = {
            name: file.originalname,
            parents: ["1OgdC_oD3obouDOImQlA9f07-mUE_EQsk"],
          };

          const media = {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.path), // Ensure path is valid
          };

          // Create a promise for each file upload
          const uploadPromise = drive.files
            .create({
              resource: fileMetadata,
              media: media,
              fields: "id",
            })
            .then((fileResponse) => {
              console.log(
                `${file.originalname} uploaded with ID: ${fileResponse.data.id}`
              );

              // Delete the uploaded file from the server
              fs.unlinkSync(file.path);

              return {
                fieldName,
                fileId: fileResponse.data.id,
                message: `${file.originalname} uploaded successfully.`,
              };
            })
            .catch((error) => {
              console.error(
                `Error uploading ${file.originalname} to Google Drive`,
                error
              );

              // Cleanup: Delete the file from the server even if upload fails
              fs.unlinkSync(file.path);

              return {
                fieldName,
                message: `Failed to upload ${file.originalname}.`,
              };
            });

          // Push the promise to the array
          uploadPromises.push(uploadPromise);
        });
      }

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);

      res.status(200).json({
        success: true,
        results,
      });
    } catch (error) {
      console.error("Error processing files", error);
      res.status(500).send("Failed to process files.");
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
