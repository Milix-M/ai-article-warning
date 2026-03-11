(function() {
  'use strict';

  // すでに実行済みならスキップ
  if (window.aiArticleWarningInjected) return;
  window.aiArticleWarningInjected = true;

  console.log('[AI Article Warning] コンテンツスクリプト読み込み完了');

  // AIっぽいパターン（正規表現）
  const AI_PATTERNS = [
    // 過度に丁寧・抽象的な表現
    /存知の通り/g,
    /皆様|みなさま/g,
    /周知の通り/g,
    // 「〜でしょう」が連続
    /でしょう/g,
    // 「〜かもしれません」が多い
    /かもしれません/g,
    // 抽象的な接続詞・フレーズ
    /\n\s*まず/g,
    /\n\s*次に/g,
    /\n\s*さらに/g,
    /\n\s*最後に/g,
    /結論として/g,
    /要約すると/g,
    /以上となります/g,
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
          pattern: pattern.source,
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

    // 【新】強調表現（**や*）の多用
    // **text** = 太字、*text* = 斜体（単語境界で囲まれたもののみ）
    const boldMatches = text.match(/\*\*[\w\sぁ-んァ-ン一-龠]{2,30}\*\*/g) || [];
    // *text* の形式で、**text** を除外（単純な単語のみ）
    const italicMatches = text.match(/\*[\wぁ-んァ-ン一-龠]{2,20}\*/g) || [];
    const emphasisCount = boldMatches.length + italicMatches.length;
    if (emphasisCount >= 5) {
      score += 3;
      matches.push({ pattern: '強調表現の多用', count: emphasisCount });
    }

    // 【新】絵文字リスト形式（・🚀 概要: 説明）
    // 行頭の・または- に続いて絵文字が来て、:か：で区切られているパターン
    const emojiListPattern = /^[・\-]\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}][^:：]*[:：]/gmu;
    const emojiListMatches = text.match(emojiListPattern) || [];
    if (emojiListMatches.length >= 3) {
      score += 3;
      matches.push({ pattern: '絵文字リスト形式', count: emojiListMatches.length });
    }

    return { score, matches };
  }

  // 警告バナーを作成
  function createWarningBanner(score, matches) {
    const banner = document.createElement('div');
    banner.id = 'ai-article-warning-banner';
    
    let severity = 'low';
    if (score >= 15) severity = 'high';
    else if (score >= 5) severity = 'medium';

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
    const isZenn = location.hostname === 'zenn.dev' && 
                   location.pathname.includes('/articles/');
    console.log('[AI Article Warning] Zenn判定:', isZenn, location.hostname, location.pathname);
    return isZenn;
  }

  // Qiitaの記事ページかチェック
  function isQiitaArticle() {
    const isQiita = location.hostname === 'qiita.com' && 
                    location.pathname.includes('/items/');
    console.log('[AI Article Warning] Qiita判定:', isQiita, location.hostname, location.pathname);
    return isQiita;
  }

  // 記事本文を取得
  function getArticleText() {
    let articleText = '';
    let selectorUsed = '';
    
    if (isZennArticle()) {
      // Zenn: 複数のセレクタを試す
      const selectors = [
        'article[class*="Article_body"]',
        '.article-body',
        'article',
        'main article',
        '[class*="content"]'
      ];
      
      for (const selector of selectors) {
        const article = document.querySelector(selector);
        if (article) {
          articleText = article.innerText;
          selectorUsed = selector;
          console.log('[AI Article Warning] Zenn: セレクタヒット:', selector, '文字数:', articleText.length);
          break;
        }
      }
    } else if (isQiitaArticle()) {
      // Qiita: 複数のセレクタを試す
      const selectors = [
        '[data-testid="article-body"]',
        '.it-MdContent',
        'article',
        '[class*="article_body"]',
        'main [class*="content"]'
      ];
      
      for (const selector of selectors) {
        const article = document.querySelector(selector);
        if (article) {
          articleText = article.innerText;
          selectorUsed = selector;
          console.log('[AI Article Warning] Qiita: セレクタヒット:', selector, '文字数:', articleText.length);
          break;
        }
      }
    }

    if (!articleText) {
      console.log('[AI Article Warning] 記事本文が取得できませんでした。試行したセレクタ:', selectorUsed);
      // フォールバック: body全体から取得
      const bodyText = document.body.innerText;
      if (bodyText.length > 500) {
        console.log('[AI Article Warning] body.innerTextをフォールバック使用:', bodyText.length);
        return bodyText;
      }
    }

    return articleText;
  }

  // バナーを挿入する場所を取得して挿入
  function insertBanner(banner) {
    if (isZennArticle()) {
      // Zenn: View_content の中で View_main の前に挿入
      const viewContent = document.querySelector('[class*="View_content"]');
      const viewMain = document.querySelector('[class*="View_main"]');
      if (viewContent && viewMain) {
        viewContent.insertBefore(banner, viewMain);
        console.log('[AI Article Warning] Zenn: View_main の前にバナーを挿入');
        return true;
      }
      
      // フォールバック: タグリストの上
      const topicsContainer = document.querySelector('[class*="View_topics"], [class*="topics"]');
      if (topicsContainer && topicsContainer.parentNode) {
        topicsContainer.parentNode.insertBefore(banner, topicsContainer);
        console.log('[AI Article Warning] Zenn: タグリストの上にバナーを挿入（フォールバック）');
        return true;
      }
      
      // フォールバック2: H1の直後
      const h1 = document.querySelector('h1');
      if (h1 && h1.parentNode) {
        if (h1.nextSibling) {
          h1.parentNode.insertBefore(banner, h1.nextSibling);
        } else {
          h1.parentNode.appendChild(banner);
        }
        console.log('[AI Article Warning] Zenn: H1の直後にバナーを挿入（フォールバック2）');
        return true;
      }
    } else if (isQiitaArticle()) {
      // Qiita: 記事ヘッダーの後か、本文の前に挿入
      const selectors = [
        '[data-testid="article-body"]',
        '.it-MdContent',
        'article',
        'main'
      ];
      for (const selector of selectors) {
        const target = document.querySelector(selector);
        if (target && target.parentNode) {
          target.parentNode.insertBefore(banner, target);
          console.log('[AI Article Warning] Qiita: バナーを挿入', selector);
          return true;
        }
      }
    }
    return false;
  }

  // メイン処理
  function analyzeArticle() {
    console.log('[AI Article Warning] analyzeArticle開始');
    
    // すでにバナーがある場合はスキップ
    if (document.getElementById('ai-article-warning-banner')) {
      console.log('[AI Article Warning] 既にバナーあり、スキップ');
      return;
    }

    // ZennでもQiitaでもない場合はスキップ
    if (!isZennArticle() && !isQiitaArticle()) {
      console.log('[AI Article Warning] 対象サイトではありません');
      return;
    }

    const text = getArticleText();
    if (!text || text.length < 100) {
      console.log('[AI Article Warning] 記事本文が取得できませんでした。文字数:', text?.length || 0);
      return;
    }

    console.log('[AI Article Warning] 記事解析開始...文字数:', text.length);
    const { score, matches } = calculateAIScore(text);
    console.log('[AI Article Warning] AIスコア:', score, matches);

    // スコアが一定以上なら警告表示（低くして常に表示）
    if (score >= 3) {
      const banner = createWarningBanner(score, matches);
      const inserted = insertBanner(banner);
      
      if (inserted) {
        console.log('[AI Article Warning] 警告バナーを表示しました');
      } else {
        console.log('[AI Article Warning] バナー挿入に失敗');
        // フォールバック: bodyの先頭に挿入
        document.body.insertBefore(banner, document.body.firstChild);
      }
    } else {
      console.log('[AI Article Warning] スコアが閾値未満:', score);
    }
  }

  // ページ読み込み完了後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', analyzeArticle);
  } else {
    // すでに読み込み完了している場合
    console.log('[AI Article Warning] 既にDOMContentLoaded済み、即時実行');
    analyzeArticle();
  }

  // フォールバック: 3秒後にも実行（遅延ロード対応）
  setTimeout(analyzeArticle, 3000);

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
