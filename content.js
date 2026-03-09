(function() {
  'use strict';

  // すでに実行済みならスキップ
  if (window.aiArticleWarningInjected) return;
  window.aiArticleWarningInjected = true;

  console.log('[AI Article Warning] コンテンツスクリプト読み込み完了');

  // AIっぽいパターン（正規表現）
  const AI_PATTERNS = [
    // 過度に丁寧・抽象的な表現
    /\n?[（(]?\n?\s*(?:ご)?存知の通り\s*\n?[)）]?/gi,
    /\n?[（(]?\n?\s*皆様ご存知の通り\s*\n?[)）]?/gi,
    /\n?[（(]?\n?\s*周知の通り\s*\n?[)）]?/gi,
    // 「〜でしょう」が連続
    /でしょう[。！]?/g,
    // 「〜かもしれません」が多い
    /かもしれません/g,
    // 抽象的な接続詞・フレーズ
    /\n\s*まず\s*\n/g,
    /\n\s*次に\s*\n/g,
    /\n\s*さらに\s*\n/g,
    /\n\s*最後に\s*\n/g,
    // 日本語として不自然な表現
    /\n\s*結論として\s*\n/g,
    /\n\s*要約すると\s*\n/g,
    /\n\s*以上となります\s*\n/g,
  ];

  // スコア計算
  function calculateAIScore(text) {
    let score = 0;
    let matches = [];

    AI_PATTERNS.forEach((pattern, index) => {
      const patternMatches = text.match(pattern);
      if (patternMatches) {
        // パターンによって重み付け
        let weight = 1;
        if (index <= 2) weight = 3; // 「〜の通り」系は重い
        if (index === 3) weight = Math.min(patternMatches.length, 5); // 「でしょう」は回数で重み
        if (index === 4) weight = Math.min(patternMatches.length, 5); // 「かもしれません」も回数で
        
        score += weight;
        matches.push({
          pattern: pattern.source.substring(0, 30) + '...',
          count: patternMatches.length
        });
      }
    });

    // 文の長さの平均が長すぎる場合もAIっぽい
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      if (avgLength > 80) {
        score += 2;
        matches.push({ pattern: '長文の多用', count: Math.round(avgLength) });
      }
    }

    // 「です」「ます」調の徹底具合
    const desuMasuCount = (text.match(/です[。\n]/g) || []).length + 
                          (text.match(/ます[。\n]/g) || []).length;
    const totalSentences = sentences.length;
    if (totalSentences > 5 && desuMasuCount / totalSentences > 0.9) {
      score += 2;
      matches.push({ pattern: '過度に整った敬体', count: desuMasuCount });
    }

    return { score, matches };
  }

  // 警告バナーを作成
  function createWarningBanner(score, matches) {
    const banner = document.createElement('div');
    banner.id = 'ai-article-warning-banner';
    
    let severity = 'low';
    if (score >= 15) severity = 'high';
    else if (score >= 8) severity = 'medium';

    const messages = {
      high: '⚠️ この記事はAI執筆の可能性が高いです',
      medium: '💡 この記事にAIっぽい表現が見られます',
      low: 'ℹ️ この記事をチェックしました'
    };

    banner.innerHTML = `
      <div class="ai-warning-content">
        <span class="ai-warning-icon">${severity === 'high' ? '🤖' : severity === 'medium' ? '⚡' : '✓'}</span>
        <span class="ai-warning-text">${messages[severity]} (スコア: ${score})</span>
        <button class="ai-warning-close">×</button>
      </div>
      ${severity !== 'low' ? `
        <div class="ai-warning-details">
          <p>検出されたパターン:</p>
          <ul>
            ${matches.slice(0, 5).map(m => `<li>${m.pattern}: ${m.count}回</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    banner.className = `ai-warning-banner ai-warning-${severity}`;
    
    // 閉じるボタンの動作
    banner.querySelector('.ai-warning-close').addEventListener('click', () => {
      banner.remove();
    });

    return banner;
  }

  // Zennの記事ページかチェック
  function isZennArticle() {
    return location.hostname === 'zenn.dev' && 
           location.pathname.match(/^\/[\w-]+\/articles\/[\w-]+$/);
  }

  // Qiitaの記事ページかチェック
  function isQiitaArticle() {
    return location.hostname === 'qiita.com' && 
           location.pathname.match(/^\/[\w-]+\/items\/[\w-]+$/);
  }

  // 記事本文を取得
  function getArticleText() {
    let articleText = '';
    
    if (isZennArticle()) {
      // Zenn: .article-body または main 内の本文
      const article = document.querySelector('.article-body') || 
                      document.querySelector('article') ||
                      document.querySelector('main');
      if (article) {
        articleText = article.innerText;
      }
    } else if (isQiitaArticle()) {
      // Qiita: .it-MdContent または article 内の本文
      const article = document.querySelector('.it-MdContent') || 
                      document.querySelector('[data-testid="article-body"]') ||
                      document.querySelector('article');
      if (article) {
        articleText = article.innerText;
      }
    }

    return articleText;
  }

  // バナーを挿入する場所を取得
  function getInsertTarget() {
    if (isZennArticle()) {
      // Zenn: タイトルの下か、本文の前
      return document.querySelector('.article-body') ||
             document.querySelector('article') ||
             document.querySelector('main');
    } else if (isQiitaArticle()) {
      // Qiita: タイトルの下
      return document.querySelector('.it-MdContent') ||
             document.querySelector('[data-testid="article-body"]') ||
             document.querySelector('article');
    }
    return null;
  }

  // メイン処理
  function analyzeArticle() {
    // すでにバナーがある場合はスキップ
    if (document.getElementById('ai-article-warning-banner')) {
      return;
    }

    const text = getArticleText();
    if (!text || text.length < 100) {
      console.log('[AI Article Warning] 記事本文が取得できませんでした');
      return;
    }

    console.log('[AI Article Warning] 記事解析開始...');
    const { score, matches } = calculateAIScore(text);
    console.log('[AI Article Warning] AIスコア:', score, matches);

    // スコアが一定以上なら警告表示
    if (score >= 5) {
      const target = getInsertTarget();
      if (target) {
        const banner = createWarningBanner(score, matches);
        target.parentNode.insertBefore(banner, target);
        console.log('[AI Article Warning] 警告バナーを表示しました');
      }
    }
  }

  // ページ読み込み完了後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', analyzeArticle);
  } else {
    // すでに読み込み完了している場合
    setTimeout(analyzeArticle, 1000);
  }

  // SPA対応: URL変更を監視
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('[AI Article Warning] URL変更を検出:', url);
      setTimeout(analyzeArticle, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

})();
