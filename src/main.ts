import Swiper from 'swiper';
//@ts-ignore
import 'swiper/css';
import './style.css';

// import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';

let model: any, webcam: any, start: any, direction: string;
let swiperEl: Swiper;

interface Question {
  id: number;
  question: string;
  options: [string, string];
}

interface Answer {
  question: string;
  choice: string;
}

const questions: Question[] = [
  { id: 1, question: 'Sweet or Salty', options: ['Sweet', 'Salty'] },
  { id: 2, question: 'Coffee or Tea', options: ['Coffee', 'Tea'] },
  { id: 3, question: 'Beach or Mountains', options: ['Beach', 'Mountains'] },
  { id: 4, question: 'Summer or Winter', options: ['Summer', 'Winter'] },
  { id: 5, question: 'Cats or Dogs', options: ['Cats', 'Dogs'] },
  { id: 6, question: 'Pizza or Pasta', options: ['Pizza', 'Pasta'] },
  { id: 7, question: 'Books or Movies', options: ['Books', 'Movies'] },
  { id: 8, question: 'Cake or Pie', options: ['Cake', 'Pie'] },
  { id: 9, question: 'Sunrise or Sunset', options: ['Sunrise', 'Sunset'] },
  { id: 10, question: 'City or Countryside', options: ['City', 'Countryside'] }
];

const answers: Answer[] = [];
let isTransitioning = false;

const path = "/my_model/";

function createQuestionSlide(question: Question): string {
  return `
    <div class="swiper-slide">
      <p class="time-elapsed-text">Time remaining: <span id="time-elapsed">5</span>s</p>
      <div class="question-container">
        <h2 class="question-text">${question.question}?</h2>
        <div class="options">
          <button class="option-btn" data-question-id="${question.id}" data-choice="${question.options[0]}">
            ${question.options[0]}
          </button>
          <div class="or-divider">or</div>
          <button class="option-btn" data-question-id="${question.id}" data-choice="${question.options[1]}">
            ${question.options[1]}
          </button>
        </div>
      </div>
    </div>
  `;
}

function createResultsSlide(): string {
  return `
    <div class="swiper-slide results-slide">
      <div class="results-container">
        <h2 class="results-title">Your Choices</h2>
        <div id="results-list" class="results-list"></div>
      </div>
      <button class="restart-btn" id="restart-btn">Start Over</button>
    </div>`;
}

function displayResults(): void {
  const resultsList = document.getElementById('results-list');
  if (!resultsList) return;

  resultsList.innerHTML = answers.map((answer, index) => `
    <div class="result-item">
      <span class="result-number">${index + 1}.</span>
      <span class="result-question">${answer.question}</span>
      <span class="result-choice">${answer.choice}</span>
    </div>
  `).join('');
}

function initSwiper(): Swiper {
  const swiperWrapper = document.getElementById('swiper-wrapper');
  if (!swiperWrapper) throw new Error('Swiper wrapper not found');

  questions.forEach(question => {
    swiperWrapper.innerHTML += createQuestionSlide(question);
  });
  swiperWrapper.innerHTML += createResultsSlide();

  const swiper = new Swiper('.swiper', {
    allowTouchMove: false,
    on: {
      slideChange: function(swiper: Swiper) {
        isTransitioning = false;
        const currentIndex = swiper.activeIndex + 1;
        const currentEl = document.getElementById('current-question');
        if (currentEl) {
          currentEl.textContent = currentIndex > questions.length ? questions.length.toString() : currentIndex.toString();
        }

        if (swiper.activeIndex === questions.length) {
          displayResults();
          const header = document.querySelector('.header');
          if (header) {
            header.classList.add('hidden');
          }
        }
      }
    }
  });

  return swiper;
}

function handleOptionSelect(target: HTMLElement, swiper: Swiper): void {

  if (!target.classList.contains('option-btn') || !target) return;
  
  if (isTransitioning) return;

  const questionId = parseInt(target.dataset.questionId || '0');
  const choice = target.dataset.choice || '';
  
  const question = questions.find(q => q.id === questionId);
  if (!question) return;

  const currentSlide = target.closest('.swiper-slide');
  if (currentSlide) {
    const siblingButtons = currentSlide.querySelectorAll('.option-btn');
    siblingButtons.forEach(btn => btn.classList.remove('selected'));
  }

  const existingAnswerIndex = answers.findIndex(a => a.question === question.question);
  if (existingAnswerIndex !== -1) {
    answers[existingAnswerIndex].choice = choice;
  } else {
    answers.push({
      question: question.question,
      choice: choice
    });
  }

  target.classList.add('selected');
  isTransitioning = true;
  
  setTimeout(() => {
    swiper.slideNext();
    if (swiper.activeIndex !== questions.length) {
      initWebcam();
    }
  }, 500);
}

function init(): void {
  swiperEl = initSwiper();

  initWebcam();
  // document.addEventListener('click', (e) => handleOptionSelect(e, swiper));

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'restart-btn') {
      answers.length = 0;
      isTransitioning = false;
      swiperEl.slideTo(0);
      const header = document.querySelector('.header');
      if (header) {
        header.classList.remove('hidden');
      }
      
      const allButtons = document.querySelectorAll('.option-btn');
      allButtons.forEach(btn => btn.classList.remove('selected'));
    }
  });
}

const initWebcam = async () => {
  const modelPath = path + "model.json";
  const metadataPath = path + "metadata.json";

  model = await tmImage.load(modelPath, metadataPath);

  webcam = new tmImage.Webcam(200, 200, true);

  await webcam.setup();
  await webcam.play();
  window.requestAnimationFrame(loop);

  // document.getElementById("webcam-container").appendChild(webcam.canvas);
};

const loop = async (timestamp: DOMHighResTimeStamp) => {
  let currentSlide = document.querySelector('.swiper-slide-active');
  let optionBtns = currentSlide?.querySelectorAll('.option-btn');

  if (start === undefined) {
    start = timestamp;
  }
  let elapsed = timestamp - start;

  // Math.min() is used here to make sure the element stops at exactly 200px
  let shift = Math.min(0.1 * elapsed, 500);

  let timeEl = currentSlide?.querySelector('#time-elapsed');
  (timeEl as HTMLElement).innerText = `${5 - Math.floor(elapsed / 1000)}`;

  if(optionBtns) {
    if (shift < 500) {
      webcam.update();
      await predict(optionBtns[0] as HTMLElement, optionBtns[1] as HTMLElement);
      window.requestAnimationFrame(loop);

    } else {
      webcam.stop();
      shift = 0;
      elapsed = 0;
      start = undefined;
      
      if(direction == 'right') {
        handleOptionSelect(optionBtns[1] as HTMLElement, swiperEl);
      } else {
        handleOptionSelect(optionBtns[0] as HTMLElement, swiperEl);
      }
    }
  }
};

const predict = async (optionOne: HTMLElement, optionTwo: HTMLElement) => {
  const predictions = await model.predict(webcam.canvas);

  const topPrediction = Math.max(...predictions.map((p: any) => p.probability));

  const topPredictionIndex = predictions.findIndex(
    (p: any) => p.probability === topPrediction
  );

  direction = predictions[topPredictionIndex].className;

  if(direction === 'right') {
    optionTwo.focus();
  } else {
    optionOne.focus();
  }
};

init();
