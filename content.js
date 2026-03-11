(function() {
  'use strict';

  // すでに実行済みならスキップ
  if (window.aiArticleWarningInjected) return;
  window.aiArticleWarningInjected = true;

  console.log('[AI Article Warning] コンテンツスクリプト読み込み完了');

  // スコア計算
  function calculateAIScore(text) {
    let score = 0;
    let matches = [];

    // 【1】文の長さの平均が長すぎる場合
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      if (avgLength > 80) {
        score += 2;
        // 長文の例を取得
        const longSentences = sentences.filter(s => s.length > 80).slice(0, 2);
        matches.push({ 
          pattern: '長文の多用', 
          count: Math.round(avgLength),
          examples: longSentences
        });
      }
    }

    // 【2】強調表現（**や*）の多用
    const boldMatches = text.match(/\*\*[\w\sぁ-んァ-ン一-龠]{2,30}\*\*/g) || [];
    const italicMatches = text.match(/\*[\wぁ-んァ-ン一-龠]{2,20}\*/g) || [];
    const emphasisCount = boldMatches.length + italicMatches.length;
    if (emphasisCount >= 5) {
      score += 3;
      const examples = [...boldMatches, ...italicMatches].slice(0, 3);
      matches.push({ pattern: '強調表現の多用', count: emphasisCount, examples });
    }

    // 【3】ダッシュ（—）の多用
    const dashPattern = /[^\n—]{2,30}[\s]+[—\-][\s]+[^\n]+/gu;
    const dashMatches = text.match(dashPattern) || [];
    if (dashMatches.length >= 2) {
      score += 5;
      const examples = dashMatches.slice(0, 3);
      matches.push({ pattern: 'ダッシュ形式の多用', count: dashMatches.length, examples });
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
            ${matches.slice(0, 5).map(m => `
              <li>
                <strong>${m.pattern}: ${m.count}回</strong>
                ${m.examples ? '<br><small style="opacity:0.8">' + m.examples.map(e => '「' + (typeof e === 'string' ? e : e.toString()).substring(0, 40) + '」').join('<br>') + '</small>' : ''}
              </li>
            `).join('')}
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

  // 記事本文を取得（コードブロック除外）
  function getArticleText() {
    let articleText = '';
    let selectorUsed = '';
    
    if (isZennArticle()) {
      const selectors = [
        '.znc',  // Zennのマークダウン本文
        '[class*="View_main"]',  // フォールバック
        'article[class*="Article_body"]',
        'article'
      ];
      
      for (const selector of selectors) {
        const article = document.querySelector(selector);
        if (article) {
          // コードブロックを除外してテキストを取得
          articleText = getTextWithoutCodeBlocks(article);
          selectorUsed = selector;
          console.log('[AI Article Warning] Zenn: セレクタヒット:', selector, '文字数:', articleText.length);
          break;
        }
      }
    } else if (isQiitaArticle()) {
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
          // コードブロックを除外してテキストを取得
          articleText = getTextWithoutCodeBlocks(article);
          selectorUsed = selector;
          console.log('[AI Article Warning] Qiita: セレクタヒット:', selector, '文字数:', articleText.length);
          break;
        }
      }
    }

    if (!articleText) {
      console.log('[AI Article Warning] 記事本文が取得できませんでした。試行したセレクタ:', selectorUsed);
      const bodyText = document.body.innerText;
      if (bodyText.length > 500) {
        console.log('[AI Article Warning] body.innerTextをフォールバック使用:', bodyText.length);
        return bodyText;
      }
    }

    return articleText;
  }

  // コードブロックを除外してテキストを取得
  function getTextWithoutCodeBlocks(element) {
    // 要素をクローンして操作
    const clone = element.cloneNode(true);
    
    // コードブロック要素を削除（code-lineは除外）
    const codeSelectors = [
      'pre',
      'code:not([class*="code-line"])',  // code-lineクラスを持つものは除外
      '[class*="highlight"]',
      '[class*="prism"]',
      'div[class*="codeBlock"]'
    ];
    
    codeSelectors.forEach(selector => {
      const codeBlocks = clone.querySelectorAll(selector);
      codeBlocks.forEach(block => block.remove());
    });
    
    return clone.innerText || '';
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
