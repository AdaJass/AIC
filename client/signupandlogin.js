"use strict";
const nodemailer = require("nodemailer");


async function sendMail(toaddress, ecode){
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let account = {user: "jass.ada@qq.com", pass: "ojygs_132_qmrkekrhgjc"};
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: "smtp.qq.com",
      port: 25,
      secure: false, // true for 465, false for other ports
      auth: {
        user: account.user, // generated ethereal user
        pass: account.pass // generated ethereal password
      }
    });
  
    // setup email data with unicode symbols
    let mailOptions = {
      from: '"UNION Administrator" <jass.ada@qq.com>', // sender address
      to: toaddress, // list of receivers
      subject: "Email Validation Code", // Subject line
    //   text: ecode, // plain text body
      html: "<b>您正在注册UNION钱包，注册码是： " + ecode + "   <br>注册码两天内有效。</b>"// html body
    };  
    // send mail with defined transport object
    let info = await transporter.sendMail(mailOptions)
}  

const signandlog = {
    emailcode: {},
    checkEmail: async(ctx)=>{
        console.log(ctx.request.body);
        let time = new Date();
        time = time.getTime();
        let eaddress = ctx.request.body.email;
        console.log("hhhhhhhhhhhhhhhhhhhhhhhh");
        console.log(signandlog.emailcode);
        if(signandlog.emailcode[eaddress]){
            return ctx.body = '0';
        }
        let ecode = Math.floor(Math.random()*1000000);
        ecode = '000000' + ecode;
        ecode = ecode.substr(-6);
        signandlog.emailcode[eaddress] = [ecode,time];
        //here try to send the email
        await sendMail(eaddress, ecode);
        ctx.body = '1';
    },
    kickout: ()=>{
        let time = new Date().getTime();
        for(var item in signandlog.emailcode){
            if(time - signandlog.emailcode[item][1] > 172800000){
                delete signandlog.emailcode[item];
            }
        }
    },
    signup: (ctx)=>{
        
    }
}

module.exports = signandlog;