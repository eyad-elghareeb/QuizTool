# QuizTool 🎯
A modern, feature-rich quiz creation and management platform built with vanilla HTML, CSS, and JavaScript. Create custom quizzes, manage multiple exam types, and test knowledge across various subjects—all in a beautiful, responsive interface.

## ✨ Features

### 🏠 Central Quiz Hub (`index.html`)
- **Unified Dashboard**: Access all your quizzes from a single, beautifully designed landing page
- **Dynamic Quiz Cards**: Automatically generated cards for each quiz/exam with icons, descriptions, and metadata
- **Theme Support**: Built-in dark/light mode toggle with persistent user preference
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Easy Extension**: Simply add new quiz configurations to the `QUIZZES` array to expand your quiz library

### 🔧 Quiz Maker (`quiz-maker.html`)
Create custom quizzes without any coding required!

- **Visual Question Builder**: Add questions with multiple-choice options (A-E)
- **Flexible Configuration**:
  - Custom quiz titles and descriptions
  - Unlimited questions
  - Multiple answer options per question
  - Correct answer selection
  - Optional explanations for each question
- **Live Preview**: Generate and preview quiz JSON output instantly
- **Export Functionality**: Download your custom quiz as a standalone HTML file
- **Form Management**: Reset form with confirmation and draft support
- **Toast Notifications**: User-friendly feedback for actions

### 💻 Quiz Maker JS (`quiz-maker-js.html`)
JavaScript-based interactive quiz creation tool with enhanced functionality.

### 🔀 Quiz Combiner (`quiz-combiner.html`)
Merge multiple quiz HTML files into a unified Question Bank!

- **Multi-File Import**: Drop any number of quiz HTML files to combine
- **Duplicate Removal**: Automatically detects and removes duplicate questions
- **Custom Bank Naming**: Configure your combined bank with a custom name
- **One-Click Download**: Export the merged question bank instantly
- **Perfect for**: Building comprehensive test banks from multiple sources

### 🏦 Bank Maker (`bank-maker.html`)
Create smart Question Banks with intelligent session tracking!

- **JS Array Input**: Build banks from large JavaScript question arrays
- **Session Memory**: Remembers which questions you've already seen
- **Fresh Questions**: Always serves unseen questions each session
- **Coverage Tracking**: Monitors progress through the entire question pool
- **Ideal for**: Large question pools where variety is essential

### 📄 PDF Exporter (`pdf-exporter.html`)
Export your quizzes to clean, printable PDF format!

- **HTML to PDF**: Convert quiz HTML files to professional PDF documents
- **Print-Ready**: Clean formatting optimized for printing
- **Offline Distribution**: Share quizzes in a universally accessible format
- **Perfect for**: Creating physical test materials or study guides

### ⚡ JavaScript Mastery Bank (`js-question-bank.html`)
Comprehensive JavaScript question bank with 51 questions!

- **Extensive Coverage**: Closures, async/await, arrays, prototypes, and more
- **Flexible Session Size**: Pick how many questions to answer each session
- **Smart Selection**: Fresh questions every time with automatic tracking
- **Progress Monitoring**: Track your coverage of the entire question set
- **Great for**: Mastering JavaScript concepts through repeated practice

### 📚 Quiz Templates (`quizes/quiz-template.html`)
Pre-built quiz template for creating standardized exams with:
- Professional styling matching the main theme
- Score tracking and progress indicators
- Immediate feedback on answers
- Explanation display after answering
- Final score summary

## 🎨 Design & Theming

QuizTool features a sophisticated design system with:

- **Modern Typography**: Uses Google Fonts (Outfit for body, Playfair Display for headings)
- **CSS Variables**: Comprehensive theming with customizable colors, spacing, and effects
- **Smooth Transitions**: Polished animations and hover effects throughout
- **Accessible UI**: High contrast ratios and clear visual hierarchy
- **Custom Color Palettes**:
  - Dark Theme: Deep blues and grays with amber accent (#f0a500)
  - Light Theme: Warm neutrals with golden accent (#c27803)

## 🚀 Getting Started

### Quick Start
1. Open `index.html` in your web browser
2. Select an existing quiz or use the Quiz Maker to create your own
3. Toggle between dark/light themes using the sun/moon icon

### Creating a Custom Quiz

1. Navigate to `quiz-maker.html`
2. Enter your quiz title and description
3. Add questions:
   - Type your question text
   - Fill in 2-5 answer options (A-E)
   - Select the correct answer from the dropdown
   - (Optional) Add an explanation
4. Click **"+ Add Question"** to add more questions
5. Click **"📥 Generate Quiz File"** to preview
6. Click **"💾 Download as HTML File"** to save your custom quiz

### Adding New Quizzes to the Hub

Edit the `QUIZZES` array in `index.html`:

```javascript
const QUIZZES = [
  {
    title: "Your Quiz Title",
    description: "Brief description of your quiz",
    icon: "🎯",
    tags: ["Category", "Questions"],
    url: "path/to/your/quiz.html"
  }
];
```

## 📁 Project Structure

```
QuizTool/
├── index.html              # Main hub/landing page
├── quiz-maker.html         # Visual quiz builder
├── quiz-maker-js.html      # JavaScript-based quiz maker
├── quiz-combiner.html      # Merge multiple quizzes into one bank
├── bank-maker.html         # Create smart question banks with session tracking
├── pdf-exporter.html       # Export quizzes to PDF format
├── js-question-bank.html   # JavaScript mastery question bank (51 questions)
├── README.md               # This file
└── quizes/
    └── quiz-template.html  # Base template for generated quizzes
```

## 🛠️ Technical Details

### Technologies Used
- **HTML5**: Semantic markup structure
- **CSS3**: Custom properties, Flexbox, Grid layouts
- **Vanilla JavaScript**: No frameworks or build tools required
- **Local Storage**: Persists theme preferences and form drafts
- **Google Fonts**: Outfit and Playfair Display typefaces

### Browser Compatibility
Works on all modern browsers including:
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile browsers

### No Dependencies
QuizTool requires no external libraries, package managers, or build processes. Simply open the HTML files in any browser!

## 🎯 Use Cases

- **Educators**: Create custom tests and assessments for students
- **Trainers**: Build knowledge checks for training programs
- **Content Creators**: Develop interactive quizzes for audiences
- **Self-Learners**: Test your knowledge on various topics
- **Event Organizers**: Create fun quiz competitions

## 🌟 Key Benefits

1. **No Coding Required**: Build quizzes through an intuitive visual interface
2. **Instant Deployment**: Generated quizzes are standalone HTML files
3. **Professional Design**: Polished, modern UI that looks great on any device
4. **Fully Customizable**: Modify templates or styles to match your brand
5. **Offline Capable**: Works without internet connection after initial load
6. **Privacy-Focused**: All data stays local; no server required

## 🔗 Links

- [View on GitHub](https://github.com/eyad-elghareeb/QuizTool)

## 📝 License

This project is open source and available for personal and commercial use.

---

**Made with ❤️ using vanilla web technologies**
