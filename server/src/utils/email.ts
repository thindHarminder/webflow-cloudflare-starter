
export async function sendOtp(fromEmail:string, toEmail:string, toName:string, otpcode:string, subject:string, key:string){
    const emailData = {
        from: {
            email: fromEmail,
            name: 'Harminder Thind'
        },
        to: [
            {
                email: toEmail,
                name: toName
            }
        ],
        subject: subject,
        variables: [
            {
                email: toEmail,
                substitutions: [
                    {
                        var: 'otp',
                        value: otpcode
                    },
                    {
                        var: 'body',
                        value: 'Please use the verification code above to verify your email address.'
                    },
                    {
                        var: 'heading',
                        value: 'Verification Code'
                    }
                ]
            }
        ],
        template_id: 'z86org8nkpkgew13'
    };

    const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${key}`
    };

    try {
        await fetch('https://api.mailersend.com/v1/email', { method: 'POST', body: JSON.stringify(emailData), headers });
    } catch (error) {
        console.error(error);
    }
}

export async function sendEmail(fromEmail:string, toEmail:string, toName:string, subject:string, heading:string, body:string, buttonLink:string, buttonName:string, key:string){
    const emailData = {
        from: {
            email: fromEmail,
            name: 'Harminder Thind'
        },
        to: [
            {
                email: toEmail,
                name: toName
            }
        ],
        subject: subject,
        variables: [
            {
                email: toEmail,
                substitutions: [
                    {
                        "var": "body",
                        "value": body
                    },
                    {
                        "var": "heading",
                        "value": heading
                    },
                    {
                        "var": "full_name",
                        "value": toName
                    },
                    {
                        "var": "button_link",
                        "value": buttonLink
                    },
                    {
                        "var": "button_name",
                        "value": buttonName
                    }
                ]
            }
        ],
        template_id: '3yxj6ljd6p0ldo2r'
    };

    const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${key}`
    };

    try {
        console.log('sending email');
        await fetch('https://api.mailersend.com/v1/email', { method: 'POST', body: JSON.stringify(emailData), headers });
    } catch (error) {
        console.error(error);
    }
}
