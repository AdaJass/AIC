"use strict";
const nodemailer = require("nodemailer");

async function sendMail(){
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let account = await nodemailer.createTestAccount();
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
             
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: account.user, // generated ethereal user
        pass: account.pass // generated ethereal password
      }
    });
  
    // setup email data with unicode symbols
    let mailOptions = {
      from: '"Fred Foo" <foo@example.com>', // sender address
      to: toaddress, // list of receivers
      subject: "Email Validation Code", // Subject line
      text: "Hello world?", // plain text body
      html: "<b>Hello world?</b>" // html body
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
        if(signandlog.eaddress){
            return ctx.body = '0';
        }
        let ecode = Math.floor(Math.random()*1000000);
        ecode = '000000' + ecode;
        ecode = ecode.substr(-6);
        signandlog.emailcode[eaddress] = [ecode,time];
        //here try to send the email
        await sendMail(eaddress);
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