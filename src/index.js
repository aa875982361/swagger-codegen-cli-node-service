/**
 * swagger-codegen 服务，具备一下功能
 * 1. 将swagger.api.json 转化为ts代码
 * 2. 可以自定义生成ts代码模板
 * 3. 对于相同的swagger.api.json 只会处理一次，多个同时调用会归为一个调用
 * 4. 对于相同的swagger.api.json 已经处理过会读取缓存
 * 5. 具备清除缓存的能力
 */
 const express = require('express')
 const bodyParser = require('body-parser');
 const expressFormidable = require('express-formidable')
 const fs = require("fs")
 const fsExtra = require("fs-extra")
 const path = require("path")
 const { md5 } = require("./utils/md5")
 const {exec} = require("child_process");
 const AdmZip = require('adm-zip');
 const eventLoop = require("./utils/eventLoop")
 // 任务队列最多同时运行多少个任务
 const maxTaskLen = process.env.ENV_MAX_TASK_LEN || 3
 console.log("任务队列最多同时运行多少个任务", Number(maxTaskLen)) ;
 eventLoop.setMaxLen(maxTaskLen)
 
 const app = express()
 app.use(expressFormidable())
 app.use(bodyParser.urlencoded({ extended: false }));
 app.use(bodyParser.json());
 // 端口
 const port = Number(process.env.ENV_SERVER_PORT || "8080")
 // 缓存文件目录
 const cachePath = path.join(__dirname, "../cache")
 // 压缩文件的根目录
 const zipBaseFileDir = path.join(cachePath, "zip")
 // 编译出来的文件夹目录
 const buildBaseFileDir = path.join(cachePath, "build")
 
 if(!fs.existsSync(cachePath)){
   fs.mkdirSync(cachePath)
 }
 if(!fs.existsSync(zipBaseFileDir)){
   fs.mkdirSync(zipBaseFileDir)
 }
 if(!fs.existsSync(buildBaseFileDir)){
   fs.mkdirSync(buildBaseFileDir)
 }
 
 // 当前在处理的请求数
 let count = 0
 // 用来保存运行中的promise
 const runPromise = {}
 
 // 重新写一个接口服务
 app.post('/swagger-codegen-file', async (req, res) => {
   /**
     * 1. 接受json
     * 2. 根据json 生成ts文件
     * 3. 将生成的ts文件夹压缩成一个压缩包。
     * 4. 返回压缩包
    */
   // 获得 swagger json 字符串
   const {swaggerJsonStr, swaggerJsonFilePath} = getSwaggerJsonStr(req)
   if(!swaggerJsonStr){
     res.status(400).send("swagger json 读取失败")
     return
   }
   // 获取json对象唯一编码，在没变的情况下code也不会变
   const uniCode = md5(swaggerJsonStr)
   // 如果之前没有处理过 就加入处理
   if(!runPromise[uniCode]){
     runPromise[uniCode] = getZipFileBySwaggerJsonStr(uniCode, swaggerJsonFilePath)
   }
   count++
   console.log("当前处理请求数", count);
   let zipFilePath = ""
   try {
     // 拿压缩包文件地址
     zipFilePath = await runPromise[uniCode]
   } catch (error) {
     console.log("拿压缩包文件失败", error);
   }
   if(runPromise[uniCode]){
     // 删除掉
     delete runPromise[uniCode]
   }
   count--
   console.log("当前处理请求数", count);
   // 没有压缩包地址就失败
   if(!zipFilePath){
     res.status(500).send("swagger json 解析失败")
     return
   }
   try {
     // 返回压缩包
     fs.createReadStream(zipFilePath).pipe(res)
   } catch (error) {
     // 兼容删除压缩包的时候，导致的错误
     res.status(500).send("请稍后再试")
   }
 })
 
 // 清除缓存
 app.get("/clear-cache", async(req, res) => {
   try {
     console.log("删除压缩包文件夹的全部内容");
     // 删除压缩包文件夹的全部内容
     fsExtra.removeSync(zipBaseFileDir)
     // 删除build文件夹
     fsExtra.removeSync(buildBaseFileDir)
   } catch (error) {
     console.log("清除缓存失败")
     res.status(500).send("清除缓存失败")
     return
   }
   // 检查压缩包文件夹路径还出不存在 不存在就创建
   if(!fs.existsSync(zipBaseFileDir)){
     fs.mkdirSync(zipBaseFileDir)
   }
   if(!fs.existsSync(buildBaseFileDir)){
     fs.mkdirSync(buildBaseFileDir)
   }
   res.status(200).send("success")
 })
 
 app.listen( port, () => {
   console.log(`cache swagger app listening at http://localhost:${port}`)
 })
 
 // -------------------- 工具函数 --------------------------
 /**
  * 获得swagger json字符串
  * @param {*} req 请求对象
  */
 function getSwaggerJsonStr(req){
    // 上传过来的json文件地址
    const tempFliePath = req.files.swagger.path
   //  console.log("tempFliePath", tempFliePath);
   try {
     return {
       swaggerJsonStr: fs.readFileSync(tempFliePath, {encoding: "utf-8"}),
       swaggerJsonFilePath: tempFliePath
     }
   } catch (error) {
     return {}
   }
 }
 
 /**
  * 获取压缩文件，通过swaggerJsonStr
  */
 const getZipFileBySwaggerJsonStr = async (uniCode, swaggerJsonFilePath) => {
   // 参数不对 就不处理
   if(!uniCode || !swaggerJsonFilePath){
     return ""
   }
   // 设置目标文件夹
   const dirName = `build-${uniCode}`
 
   // 目标ts文件夹
   const targetTsFileDir = path.join(buildBaseFileDir, `${dirName}`)
   console.log("targetTsFileDir", targetTsFileDir);
   // 压缩文件路径
   const zipFilePath = path.join(zipBaseFileDir, `${dirName}.zip`)
   // 如果压缩文件之前存在
   if(fs.existsSync(zipFilePath)){
     // 之前已经处理过， 就直接返回压缩文件路径
     console.log("读取缓存", zipFilePath);
     return zipFilePath
   }
   // 事件循环任务
   const eventLoopTask = () => {
     return genFileBySwaggerJsonFilePath(swaggerJsonFilePath, targetTsFileDir)
   }
   // 当前转换文件的任务丢到任务队列去运行
   const currentSwaggerCodegenPromise = eventLoop.runTask(eventLoopTask)
   // 等待当前任务执行完成
   await currentSwaggerCodegenPromise
   // 将文件夹压缩
   const file = new AdmZip();
   // 将ts文件夹加入到压缩文件中
   file.addLocalFolder(targetTsFileDir, dirName)
   
   // console.log("zipFilePath", zipFilePath);
   // 写入压缩文件
   try {
     fs.writeFileSync(zipFilePath, file.toBuffer())
     // console.log("写入成功");
     setTimeout(() => {
       try {
         // 延时删除build文件夹
         fsExtra.removeSync(targetTsFileDir)
       } catch (error) {
         console.log("延迟删除ts文件夹失败", error);
       }
     }, 100);
   } catch (error) {
     console.log("写入压缩文件失败", error);
     return ""
   }
   return zipFilePath
 }
 
 /**
  * 根据swagger json 获取ts文件，未压缩
  * @param {*} swaggerJsonFilePath 
  * @returns 
  */
 function genFileBySwaggerJsonFilePath(swaggerJsonFilePath, targetFileDir){
   return new Promise((resolve, reject) => {
     const commandStr = `java -jar ./swagger-codegen-cli-2.4.5.jar generate -i ${swaggerJsonFilePath} -l typescript-angular  -t ./typescript-angular -o ${targetFileDir}`
     console.log("开始执行swagger codegen 命令", commandStr);
     try {
       // 3.0 的版本需要加 --template-engine mustache 
       exec(commandStr, 
         (error, stdout, stderr) => {
           if(error){
             console.log(`执行失败 ${commandStr} error`, error);
             reject(error)
           }else{
             if(/error/i.test(stderr)){
               console.log(`执行失败 ${commandStr} 其他error`, stderr);
             }else{
               console.log(`执行完成 ${commandStr}`);
             }
             resolve()
           }
       })
     } catch (error) {
       console.log(`调用命令行失败  ${commandStr} `, error);
       reject("运行编译swagger-codegen命令失败")
     }
   })
 }