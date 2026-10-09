<script lang="ts">
  /**
   * One-question-at-a-time quiz with immediate feedback. Nothing is stored
   * or sent anywhere; reloading the page starts over.
   */
  import { tick } from 'svelte';
  import { t, tf, type Locale, type TKey } from '../i18n';

  interface Question {
    q: string;
    options: string[];
    answer: number;
    why: string;
    stars: 1 | 2 | 3;
    try?: string;
  }

  interface Props {
    lang: Locale;
    questions: Question[];
    bonus: { q: string; a: string }[];
    /** Simulation page URL; `try` presets are appended to it. */
    simUrl: string;
  }

  let { lang, questions, bonus, simUrl }: Props = $props();
  const tr = (key: TKey) => t(lang, key);

  let index = $state(0);
  let selected = $state<number | null>(null);
  let checked = $state(false);
  let score = $state(0);
  let done = $state(false);
  let heading: HTMLElement | undefined = $state();

  const current = $derived(questions[index]!);
  const total = $derived(questions.length);
  const correct = $derived(checked && selected === current.answer);
  const letters = 'abcdefgh';

  function check() {
    if (selected === null || checked) return;
    checked = true;
    if (selected === current.answer) score++;
  }

  async function next() {
    if (index + 1 >= total) {
      done = true;
    } else {
      index++;
      selected = null;
      checked = false;
    }
    await tick();
    heading?.focus();
  }

  async function restart() {
    index = 0;
    selected = null;
    checked = false;
    score = 0;
    done = false;
    await tick();
    heading?.focus();
  }

  const starsLabel = (n: 1 | 2 | 3) => `${tr('quiz.difficulty')}: ${tr(`quiz.stars${n}`)}`;
  const scoreMessage = $derived(
    score === total ? tr('quiz.scorePerfect') : score >= total * 0.6 ? tr('quiz.scoreGood') : tr('quiz.scoreLow'),
  );
</script>

<div class="quiz">
  {#if !done}
    <div class="quiz__top">
      <span>{tf(lang, 'quiz.question', { n: index + 1, total })}</span>
      <span class="stars" title={starsLabel(current.stars)} aria-label={starsLabel(current.stars)}>
        {'★'.repeat(current.stars)}<span class="stars__off">{'★'.repeat(3 - current.stars)}</span>
      </span>
    </div>
    <div class="progress" aria-hidden="true"><span style:width="{(index / total) * 100}%"></span></div>

    <fieldset class="card">
      <legend class="visually-hidden">{current.q}</legend>
      <h2 tabindex="-1" bind:this={heading}>{current.q}</h2>
      <div class="options">
        {#each current.options as option, i (i)}
          {@const isAnswer = checked && i === current.answer}
          {@const isWrongPick = checked && i === selected && i !== current.answer}
          <label class="option" class:option--right={isAnswer} class:option--wrong={isWrongPick}>
            <input type="radio" name="answer" value={i} bind:group={selected} disabled={checked} />
            <span class="letter" aria-hidden="true">{isAnswer ? '✓' : isWrongPick ? '✗' : letters[i]}</span>
            <span>{option}</span>
          </label>
        {/each}
      </div>

      {#if checked}
        <div class="feedback" class:feedback--right={correct} role="status">
          <p class="feedback__head">{correct ? tr('quiz.correct') : tr('quiz.wrong')}</p>
          {#if !correct}
            <p>{tf(lang, 'quiz.answerIs', { a: current.options[current.answer]! })}</p>
          {/if}
          <p>{current.why}</p>
          {#if current.try}
            <p><a href={simUrl + current.try}>{tr('quiz.tryIt')} →</a></p>
          {/if}
        </div>
      {/if}

      <div class="actions">
        {#if !checked}
          <button type="button" class="button" disabled={selected === null} onclick={check}>{tr('quiz.check')}</button>
        {:else}
          <button type="button" class="button" onclick={next}>
            {index + 1 >= total ? tr('quiz.finish') : tr('quiz.next')}
          </button>
        {/if}
      </div>
    </fieldset>
  {:else}
    <div class="card result">
      <h2 tabindex="-1" bind:this={heading}>{tf(lang, 'quiz.score', { score, total })}</h2>
      <p class="result__stars" aria-hidden="true">
        {#each questions as _, i (i)}<span class:on={i < score}>★</span>{/each}
      </p>
      <p>{scoreMessage}</p>
      <button type="button" class="button" onclick={restart}>{tr('quiz.again')}</button>
    </div>
  {/if}

  {#if bonus.length}
    <section class="bonus">
      <h2>{tr('quiz.bonusTitle')}</h2>
      <p class="muted">{tr('quiz.bonusIntro')}</p>
      {#each bonus as b, i (i)}
        <div class="card bonus__item">
          <p><strong>{total + i + 1}.</strong> {b.q}</p>
          <details>
            <summary>{tr('quiz.showAnswer')}</summary>
            <p>{b.a}</p>
          </details>
        </div>
      {/each}
    </section>
  {/if}
</div>

<style>
  .quiz {
    display: grid;
    gap: var(--space-4);
  }

  .quiz__top {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    color: var(--ink-2);
  }

  .stars {
    color: #e0a000;
    letter-spacing: 2px;
  }

  .stars__off {
    color: var(--border);
  }

  .progress {
    height: 8px;
    border-radius: 4px;
    background: var(--border);
    overflow: hidden;
  }

  .progress span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width 0.3s;
  }

  .card {
    margin: 0;
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: var(--shadow);
  }

  fieldset {
    min-width: 0;
  }

  h2 {
    font-size: var(--text-lg);
    line-height: 1.35;
    margin-bottom: var(--space-4);
  }

  h2:focus {
    outline: none;
  }

  .options {
    display: grid;
    gap: var(--space-2);
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: var(--space-2) var(--space-4);
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .option:has(input:checked) {
    border-color: var(--brand);
    background: #eef4fd;
  }

  .option:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .option:has(input:disabled) {
    cursor: default;
  }

  .option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .letter {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--border);
    font-weight: 700;
  }

  .option--right {
    border-color: #00873a !important;
    background: #e8f6ee !important;
  }

  .option--right .letter {
    background: #00873a;
    border-color: #00873a;
    color: #fff;
  }

  .option--wrong {
    border-color: #c82828 !important;
    background: #fbecec !important;
  }

  .option--wrong .letter {
    background: #c82828;
    border-color: #c82828;
    color: #fff;
  }

  .feedback {
    margin-top: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-left: 5px solid #c25e00;
    border-radius: var(--radius-sm);
    background: #fff5e8;
  }

  .feedback--right {
    border-left-color: #00873a;
    background: #e8f6ee;
  }

  .feedback p {
    margin: 0 0 var(--space-1);
  }

  .feedback__head {
    font-weight: 700;
    font-size: var(--text-lg);
  }

  .actions {
    margin-top: var(--space-4);
  }

  .button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .result {
    text-align: center;
  }

  .result__stars {
    font-size: 1.8rem;
    color: var(--border);
    letter-spacing: 4px;
  }

  .result__stars .on {
    color: #e0a000;
  }

  .bonus {
    margin-top: var(--space-6);
  }

  .bonus h2 {
    font-size: var(--text-xl);
    margin-bottom: var(--space-2);
  }

  .bonus__item {
    margin-top: var(--space-3);
    padding: var(--space-4);
    box-shadow: none;
  }

  .bonus__item p {
    margin: 0;
  }

  details {
    margin-top: var(--space-2);
  }

  summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    color: var(--brand);
    font-weight: 700;
    cursor: pointer;
  }

  details p {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }

  .muted {
    color: var(--ink-2);
  }
</style>
