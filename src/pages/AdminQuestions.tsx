import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Question, DimensionWeights } from '../types';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Save, X, Database } from 'lucide-react';

const SEED_QUESTIONS: Partial<Question>[] = [
  // Section 1: Thinking Style (1–10)
  {
    text: "When you start a new project, what do you do first?",
    active: true,
    order: 1,
    options: [
      { text: "Assign tasks to the team", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Create a clear plan", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Talk to people to understand requirements", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Generate creative ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze the problem deeply", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Start executing immediately", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You prefer working in:",
    active: true,
    order: 2,
    options: [
      { text: "Leading a team", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organizing tasks", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Communicating with people", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creating new ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Solving problems", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Executing tasks", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "When facing a problem:",
    active: true,
    order: 3,
    options: [
      { text: "Lead a discussion with the team", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Go back to the plan", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Ask someone experienced", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Think outside the box", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze root causes", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Try quick solutions", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "Your strongest trait is:",
    active: true,
    order: 4,
    options: [
      { text: "Decision making", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organization", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Persuasion", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creativity", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Logical thinking", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Fast execution", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "If a project fails:",
    active: true,
    order: 5,
    options: [
      { text: "Take responsibility", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Review the plan", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Check communication gaps", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Think of new ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze the reasons", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Restart quickly", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "When someone asks for help:",
    active: true,
    order: 6,
    options: [
      { text: "Guide them", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organize their work", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Explain clearly", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Give creative ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze their issue", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Help them practically", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You prefer to be:",
    active: true,
    order: 7,
    options: [
      { text: "The leader", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "The organizer", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "The communicator", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "The creator", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "The analyst", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "The executor", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "In your free time, you prefer:",
    active: true,
    order: 8,
    options: [
      { text: "Developing leadership skills", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organizing your life", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Meeting people", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creating something new", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Learning analytical skills", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Doing practical work", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You enjoy:",
    active: true,
    order: 9,
    options: [
      { text: "Controlling project direction", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Following systems", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Talking to people", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Innovating", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyzing", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Executing", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "What annoys you the most?",
    active: true,
    order: 10,
    options: [
      { text: "Lack of leadership", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Chaos", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Poor communication", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Routine work", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Illogical decisions", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Delays", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  // Section 2: Work Style (11–20)
  {
    text: "You prefer work that is:",
    active: true,
    order: 11,
    options: [
      { text: "Team-led by you", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Well-organized", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Communication-based", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Open to creativity", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analytical", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Practical", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "When facing a deadline:",
    active: true,
    order: 12,
    options: [
      { text: "Delegate tasks", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Set priorities", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Follow up with the team", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Think creatively", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Focus on solving the problem", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Work fast", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "In a team, people see you as:",
    active: true,
    order: 13,
    options: [
      { text: "A leader", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organized", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "A communicator", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creative", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "A thinker", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Hardworking", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "If someone disagrees with you:",
    active: true,
    order: 14,
    options: [
      { text: "Lead them to the right decision", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Refer to the plan", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Discuss with them", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Suggest new ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Explain logically", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Apply the solution", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You enjoy projects that involve:",
    active: true,
    order: 15,
    options: [
      { text: "Leadership", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organization", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "People interaction", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creativity", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analysis", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Execution", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "Under pressure:",
    active: true,
    order: 16,
    options: [
      { text: "Take control", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organize tasks", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Communicate calmly", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Think creatively", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Stay focused", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Deliver results", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You learn best through:",
    active: true,
    order: 17,
    options: [
      { text: "Leading", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Planning", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Discussion", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Experimentation", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analysis", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Practice", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You are more:",
    active: true,
    order: 18,
    options: [
      { text: "Decisive", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organized", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Social", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Imaginative", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Logical", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Practical", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "When facing a big issue:",
    active: true,
    order: 19,
    options: [
      { text: "Take control", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Structure it", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Talk with the team", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Generate ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze it", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Solve it quickly", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You prefer to:",
    active: true,
    order: 20,
    options: [
      { text: "Lead", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organize", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Communicate", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Create", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Think", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Execute", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  // Section 3: Skills & Role (21–30)
  {
    text: "Your ideal role is:",
    active: true,
    order: 21,
    options: [
      { text: "Team Leader", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Project Manager", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "PR / Communication", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Designer / Creative", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyst", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Executor", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You enjoy the most:",
    active: true,
    order: 22,
    options: [
      { text: "Leading", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organizing", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Talking", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Designing", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyzing", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Executing", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "If you choose a specialization:",
    active: true,
    order: 23,
    options: [
      { text: "Leadership", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Management", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Marketing / PR", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Design", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Data / Tech", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Operations", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You prefer to:",
    active: true,
    order: 24,
    options: [
      { text: "Lead people", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Manage projects", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Interact with people", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Create ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze data", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Execute tasks", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "Your strength is:",
    active: true,
    order: 25,
    options: [
      { text: "Leadership", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organization", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Communication", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creativity", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analysis", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Execution", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "In an event, you would:",
    active: true,
    order: 26,
    options: [
      { text: "Lead it", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organize it", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Handle people", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Create ideas", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze results", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Execute tasks", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You prefer to be:",
    active: true,
    order: 27,
    options: [
      { text: "Responsible", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organized", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "The face of the team", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creative", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analytical", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Productive", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You succeed most in:",
    active: true,
    order: 28,
    options: [
      { text: "Leading", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Organizing", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Networking", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Creating", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Thinking", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Doing", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "You prefer to:",
    active: true,
    order: 29,
    options: [
      { text: "Control", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Structure", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Communicate", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "Innovate", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "Analyze", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "Execute", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  },
  {
    text: "At your core, you are:",
    active: true,
    order: 30,
    options: [
      { text: "A leader", weights: { leadership: 1, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "An organizer", weights: { leadership: 0, organization: 1, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: "A communicator", weights: { leadership: 0, organization: 0, communication: 1, creativity: 0, analysis: 0, execution: 0 } },
      { text: "A creator", weights: { leadership: 0, organization: 0, communication: 0, creativity: 1, analysis: 0, execution: 0 } },
      { text: "An analyst", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 1, execution: 0 } },
      { text: "An executor", weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 1 } },
    ]
  }
];

export default function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const [formData, setFormData] = useState<Partial<Question>>({
    text: '',
    active: true,
    order: 0,
    options: [
      { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
      { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
    ]
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const q = query(collection(db, 'questions'), orderBy('order', 'asc'));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'questions');
        return;
      }
      setQuestions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (questions.length > 0) {
      if (!window.confirm("Questions already exist. Do you want to add default questions anyway?")) return;
    }

    setIsSeeding(true);
    try {
      for (const sq of SEED_QUESTIONS) {
        try {
          await addDoc(collection(db, 'questions'), sq);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'questions');
          return;
        }
      }
      toast.success("Default questions seeded successfully!");
      fetchQuestions();
    } catch (error) {
      console.error("Error seeding questions:", error);
      toast.error("Failed to seed questions");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async () => {
    if (!formData.text || formData.options?.some(o => !o.text)) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      if (editingId) {
        try {
          await updateDoc(doc(db, 'questions', editingId), formData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `questions/${editingId}`);
          return;
        }
        toast.success("Question updated");
      } else {
        try {
          await addDoc(collection(db, 'questions'), { ...formData, order: questions.length + 1 });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'questions');
          return;
        }
        toast.success("Question added");
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        text: '',
        active: true,
        order: 0,
        options: [
          { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
          { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
          { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
          { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
          { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
          { text: '', weights: { leadership: 0, organization: 0, communication: 0, creativity: 0, analysis: 0, execution: 0 } },
        ]
      });
      fetchQuestions();
    } catch (error) {
      toast.error("Failed to save question");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        try {
          await deleteDoc(doc(db, 'questions', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `questions/${id}`);
          return;
        }
        toast.success("Question deleted");
        fetchQuestions();
      } catch (error) {
        toast.error("Failed to delete question");
      }
    }
  };

  const updateOptionWeight = (optIdx: number, dimension: keyof DimensionWeights, value: number) => {
    const newOptions = [...(formData.options || [])];
    newOptions[optIdx].weights[dimension] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const updateOptionText = (optIdx: number, text: string) => {
    const newOptions = [...(formData.options || [])];
    newOptions[optIdx].text = text;
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Questions Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create and edit MCQ test questions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            <Database className="w-5 h-5" />
            {isSeeding ? 'Seeding...' : 'Seed Defaults'}
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Question
          </button>
        </div>
      </div>

      {(isAdding || editingId) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-indigo-200 dark:border-indigo-900 shadow-lg shadow-indigo-50 dark:shadow-none space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingId ? 'Edit Question' : 'New Question'}</h3>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Question Text</label>
              <input
                type="text"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Enter question text..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.options?.map((option, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Option {idx + 1}</label>
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOptionText(idx, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-3 text-sm"
                    placeholder="Option text..."
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(option.weights).map((dimension) => (
                      <div key={dimension}>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate">{dimension}</label>
                        <input
                          type="number"
                          value={option.weights[dimension as keyof DimensionWeights]}
                          onChange={(e) => updateOptionWeight(idx, dimension as keyof DimensionWeights, parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              <Save className="w-4 h-4" />
              Save Question
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">Order: {q.order}</span>
                  {!q.active && <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">Inactive</span>}
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">{q.text}</h4>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => { setEditingId(q.id); setFormData(q); }}
                  className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {q.options.map((opt, idx) => (
                <div key={idx} className="text-xs p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">{opt.text}</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(opt.weights).map(([dim, val]) => (
                      (val as number) > 0 && <span key={dim} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400 capitalize">{dim}: {val}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
