class EventLoop {
    constructor(_maxLen = 10){
      this.taskList = [];
      this.waitTaskList = [];
      this.maxLen = _maxLen;
      this.maxRunTime = 500000;
    }
    /**
     * 设置最大同时进行的任务数
     * @param {*} _maxLen 
     */
    setMaxLen(_maxLen){
      this.maxLen = _maxLen || 0
    }
    /**
     * 设置任务超时时间
     * @param {*} _maxRunTime 
     */
    setMaxRunTime(_maxRunTime){
      this.maxRunTime = _maxRunTime
    }
    /**
     * 运行任务
     * @param {function (any)=> Promise} task 
     */
    runTask(task) {
      return new Promise((resolve, reject) => {
        task.resolve = resolve;
        task.reject = reject;
        if(this.taskList.length < this.maxLen){
          // 直接运行
          this._run(task)
        }else{
          // 加入等待队列
          this.waitTaskList.push(task)
        }
      })
    }
    
    // 创建任务
    createTaskInOverTime(createPromiseFunc, overTime = 3000000){
      if(typeof createPromiseFunc !== "function"){
        throw new Error("传参错误,需要传入function")
      }
      return function(){
        return new Promise((resolve, reject) => {
          // const time = Math.random()*1000 >> 0;
          const timer = setTimeout(()=>{
            reject("createTaskInOverTime 超时");
          }, overTime)
          // 发出请求
          return createPromiseFunc().then(res =>{
            resolve(res)
            return
          }).catch(err=>{
            console.log("task err", err);
            return err
          }).finally((res)=>{
            clearTimeout(timer)
            return res;
          })
        })
      }
    }
  
    /**
     * 真正的运行
     * @param {function (any)=> Promise} task 
     */
     _run(task){
       this.taskList.push(task);
       console.log("this.taskLength:", this.taskList.length);
      // 给每个任务设置最长时间
      const timer = setTimeout(()=>{
        task.reject("运行超时：" + this.maxRunTime)
      }, this.maxRunTime)
      task().then(res=>{
        clearTimeout(timer)
        task.resolve(res);
        // 移除taskList中的task
        const index = this.taskList.indexOf(task);
        this.taskList.splice(index, 1);
        // 检查是否还有等待中的任务
        if(this.taskList.length < this.maxLen && this.waitTaskList.length >0){
          const nextTask = this.waitTaskList.shift();
          this._run(nextTask);
        }
      }).catch(err=>{
        // 清除掉出错的任务
        const index = this.taskList.indexOf(task)
        if(index >=0){
          this.taskList.splice(index, 1)
          // 检查是否还有等待中的任务
          if(this.taskList.length < this.maxLen && this.waitTaskList.length >0){
            const nextTask = this.waitTaskList.shift();
            this._run(nextTask);
          }
        }
        clearTimeout(timer)
        task.reject(err)
      })
    }
  }
  
  module.exports =  new EventLoop()
  