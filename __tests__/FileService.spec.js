const FileService = require("../src/file/FileService");
const fs = require("fs");
const config = require("config");
const path = require("path");

const { uploadDir, profileDir } = config;
const profileDirectory = path.join(".", uploadDir, profileDir);

describe("createFolders", () => {
  it("creates upload folder", () => {
    FileService.createFolders();
    expect(fs.existsSync(uploadDir)).toBe(true);
  });
  it("creates profile folder under upload folder", () => {
    FileService.createFolders();
    expect(fs.existsSync(profileDirectory)).toBe(true);
  });
});
