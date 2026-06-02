require('dotenv').config();

const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = __dirname;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function normalizeContactBody(body) {
  return {
    name: String(body.name || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    subject: String(body.subject || '').trim(),
    message: String(body.message || '').trim()
  };
}

function validateContact(contact) {
  const missingFields = ['name', 'email', 'subject', 'message'].filter((field) => !contact[field]);

  if (missingFields.length > 0) {
    return `Please fill in: ${missingFields.join(', ')}.`;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    return 'Please enter a valid email address.';
  }

  return null;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS')
    }
  });
}

app.post('/api/contact', async (req, res) => {
  const contact = normalizeContactBody(req.body);
  const validationError = validateContact(contact);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const mailTo = process.env.MAIL_TO || 'oluseguntaiwojoel@gmail.com';
    const transporter = createTransporter();
    const safeContact = {
      name: escapeHtml(contact.name),
      phone: escapeHtml(contact.phone || 'Not provided'),
      email: escapeHtml(contact.email),
      subject: escapeHtml(contact.subject),
      message: escapeHtml(contact.message).replace(/\n/g, '<br>')
    };

    await transporter.sendMail({
      from: `"Joel Portfolio" <${requireEnv('SMTP_USER')}>`,
      to: mailTo,
      replyTo: contact.email,
      subject: `Portfolio message: ${contact.subject}`,
      text: [
        `Name: ${contact.name}`,
        `Phone: ${contact.phone || 'Not provided'}`,
        `Email: ${contact.email}`,
        `Subject: ${contact.subject}`,
        '',
        contact.message
      ].join('\n'),
      html: `
        <h2>New portfolio message</h2>
        <p><strong>Name:</strong> ${safeContact.name}</p>
        <p><strong>Phone:</strong> ${safeContact.phone}</p>
        <p><strong>Email:</strong> ${safeContact.email}</p>
        <p><strong>Subject:</strong> ${safeContact.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${safeContact.message}</p>
      `
    });

    return res.json({ message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Contact email failed:', error);

    if (error.message && error.message.includes('SMTP_')) {
      return res.status(500).json({
        message: 'Email is not configured yet. Add SMTP_USER and SMTP_PASS to your .env file, then restart the server.'
      });
    }

    return res.status(500).json({
      message: 'Sorry, your message could not be sent right now. Please try again later.'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
});
