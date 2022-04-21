const https = require("https")
const http = require("http")
const fs = require("fs")
const path = require("path")
const request = require("request")
const AdmZip = require('adm-zip');


const swaggerFromUrls = [
  // 主流程
  {
    name: "normal",
    url: "http://localhost:8081/api-docs"
  },
]


const downloadJSON = (url, fileTag) => {
  console.log("\ndownloading", fileTag, url)
  const funcs = [http.get, https.get]
  const index = url.indexOf("https") === -1 ? 0 : 1
  funcs[index](url, (res) => {
    let str = ""
    res.setEncoding("utf-8")
    res.on("data", (chunk) => { str += chunk })
    res.on("end", () => {
      console.log("downloaded", fileTag, url, res.statusCode)
      const targetDir = `${__dirname}/${fileTag}`
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir)
      }
      const filePath = path.resolve(`${targetDir}/swagger.json`)
      fs.writeFileSync(filePath, str)
      downloadService(filePath, fileTag)
    })
  })
}

const downloadService = (filePath, fileTag) => {
  const postData = fs.createReadStream(filePath)
  const swaggerCodeGenUrl = "http://127.0.0.1:8080/swagger-codegen-file"
  const r = request.post(
    swaggerCodeGenUrl,
  )
  const form = r.form()
  form.append("swagger", postData)
  console.log("downloading zip", fileTag)
  const zipFileDir = path.join(__dirname, fileTag)
  const zipFilePath = path.join(zipFileDir, `buffer.zip`)
  r.pipe(
    fs.createWriteStream(zipFilePath)
      .on("close", () => {
        console.log("downloaded zip", fileTag)
        // 解压
        unzip(zipFilePath, zipFileDir)
      }),
  )
}

function unzip(zipFilePath, targetDir){
    const file = new AdmZip(zipFilePath)
    file.extractAllTo(targetDir, true)
}


swaggerFromUrls.map((item) => {
  downloadJSON(item.url, item.name)
})
