const express = require('express');

const config = require('../config');
const { chatCompletion } = require('../services/aiClient');
const { getSystemPrompt } = require('../systemPrompt');

const router = express.Router();

const PLANNER_INSTRUCTION = `You are now in App Builder PLANNING mode, following the APP BUILDER WORKFLOW in your master prompt.

The user will describe an app idea in everyday language. Produce a complete app blueprint with these sections:

# App Blueprint: <App Name>

## 1. Vision
One short paragraph on what the app does and who it is for.

## 2. Core Features
A numbered list of the features the first working version must have. Keep it focused on what is essential.

## 3. Screens & Navigation
Each screen with its purpose (for example: Home, Dashboard, Settings, Admin).

## 4. Data Model
The main pieces of information the app stores (users, items, orders, etc.) and how they relate.

## 5. Technology Suggestions
Free or open-source technologies first. Explain costs honestly before recommending anything paid.

## 6. Build Steps
The ordered steps to build it, written so a beginner can follow along.

## 7. Questions For You
Up to 3 essential questions only, if anything genuinely needs the user's decision.

Write in simple, encouraging language a non-technical beginner can understand.`;

router.post('/plan', async (req, res, next) => {
  try {
    const idea = req.body && typeof req.body.idea === 'string' ? req.body.idea.trim() : '';
    if (!idea) {
      return res.status(400).json({
        error: {
          message: 'Please describe your app idea. Example: { "idea": "A booking app for my barbershop" }'
        }
      });
    }

    const reply = await chatCompletion({
      messages: [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: `${PLANNER_INSTRUCTION}\n\n=== APP IDEA FROM THE USER ===\n${idea}` }
      ],
      temperature: 0.4
    });

    res.json({
      idea,
      blueprint: reply.content,
      model: config.aiModel
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
