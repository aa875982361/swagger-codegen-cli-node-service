# swagger-code-cli-node-service

## 项目介绍
本项目的目的是将swagger.api.doc的json文件转化为typescript类型的api.service，便于代码编写，减少接口比对的工作量。网上不少相同的项目，本项目是基于swagger-codegen 做的二次开发，主要工作是把swagger-codegen 做成一个node服务，后续只需要调用服务，即可转换。

## 项目优势
1. 不需要开发人员本地安装环境，只需要调用服务
2. 多人同时需要转换同一份json时，只会调用一次转换服务。
3. 之前有转换过的json，下次会读取缓存数据。
4. 多人同时需要转换多份json时，会有转换服务并发数量控制，防止瞬时服务压力过大，导致服务崩盘。

## 项目功能

### 转换json为string字符串
```
url: http://127.0.0.1:8080/swagger-codegen-file
method: post
formData: 
  swagger: (jsonFileBinary)

response:
  zip压缩包
```

### 清除压缩包文件缓存
```
url: http://127.0.0.1:8080/clear-cache
method: get

response:
  success
```
## 项目启动
npm run start
使用到的环境变量：
1. ENV_MAX_TASK_LEN 最大并发任务数 默认2
2. ENV_SERVER_PORT 端口 默认8080

## 项目测试
### 启动测试 swagger-ui 服务
```
npm run swagger-ui-services
```

通过`http://localhost:8081/docs`即可访问swagger-ui

### 运行测试代码
```
npm run test
```
查看 example/ts-project/normal 下的swagger.json 是否符合预期
以及查看build文件夹内的build-xxxxx/api/default.service.ts文件是否符合预期