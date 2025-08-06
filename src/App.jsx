import React, { useState, useEffect } from 'react';
import { Shuffle, RotateCcw, CheckCircle, Eye, EyeOff, Lightbulb, StickyNote } from 'lucide-react';

const GenomeAssemblyGame = () => {
  const [level, setLevel] = useState(1);
  const [targetSequence, setTargetSequence] = useState('');
  const [reads, setReads] = useState([]);
  const [selectedReads, setSelectedReads] = useState([]);
  const [assembledSequence, setAssembledSequence] = useState('');
  const [gameComplete, setGameComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [readMemos, setReadMemos] = useState({});
  const [showMemoInput, setShowMemoInput] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // レベル別設定（仕様に合わせて修正）
  const getLevelConfig = (level) => {
    const configs = {
      1: { 
        length: 40, 
        numReads: 4,
        avgReadLength: 15, 
        readLengthVariation: 0.1,
        errorReads: 0,
        reverseReads: 0,
        description: "基礎編：エラーなし、正鎖のみ、4reads"
      },
      2: { 
        length: 60, 
        numReads: 6,
        avgReadLength: 18, 
        readLengthVariation: 0.2,
        errorReads: 1,
        reverseReads: 1,
        description: "応用編：エラー1個、逆鎖1個、6reads"
      },
      3: { 
        length: 120, 
        numReads: 6,
        avgReadLength: 30, 
        readLengthVariation: 0.25,
        errorReads: 1,
        reverseReads: 1,
        description: "実践編：長い配列、エラー1個、逆鎖1個、6reads"
      }
    };
    return configs[level];
  };

  // 生物学的に現実的なDNA配列生成（同一塩基4連続以上を制限）
  const generateRealisticDNA = (length) => {
    const bases = ['A', 'T', 'G', 'C'];
    const sequence = [];
    
    for (let i = 0; i < length; i++) {
      let base;
      let attempts = 0;
      
      do {
        base = bases[Math.floor(Math.random() * 4)];
        attempts++;
        
        // 4回以上同じ塩基が連続するのを避ける
        const lastThree = sequence.slice(-3);
        if (lastThree.length < 3) break;
        if (!(lastThree[0] === base && lastThree[1] === base && lastThree[2] === base)) break;
        
        // 無限ループを避けるため、10回試行したら諦める
        if (attempts > 10) break;
      } while (attempts <= 10);
      
      sequence.push(base);
    }
    
    return sequence.join('');
  };

  // リバースコンプリメント
  const reverseComplement = (seq) => {
    const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
    return seq.split('').reverse().map(base => complement[base]).join('');
  };

  // エラーを導入（置換エラー）
  const introduceError = (sequence) => {
    const bases = ['A', 'T', 'G', 'C'];
    const pos = Math.floor(Math.random() * sequence.length);
    const originalBase = sequence[pos];
    const possibleBases = bases.filter(b => b !== originalBase);
    const wrongBase = possibleBases[Math.floor(Math.random() * possibleBases.length)];
    
    return sequence.substring(0, pos) + wrongBase + sequence.substring(pos + 1);
  };

  // readsを生成（確実に復元可能になるよう完全再設計）
  const generateReads = (sequence, config) => {
    const { numReads, avgReadLength, readLengthVariation, errorReads, reverseReads } = config;
    const reads = [];
    const minOverlap = Math.max(8, Math.floor(avgReadLength * 0.4)); // より確実なoverlap
    
    console.log(`Generating ${numReads} reads for sequence length ${sequence.length}`);
    console.log(`Target sequence: ${sequence}`);
    console.log(`Average read length: ${avgReadLength}, Min overlap: ${minOverlap}`);
    
    // Step 1: 各readの長さを先に決定
    const readLengths = [];
    for (let i = 0; i < numReads; i++) {
      const lengthVar = 1 + (Math.random() - 0.5) * 2 * readLengthVariation;
      const readLength = Math.max(12, Math.floor(avgReadLength * lengthVar));
      readLengths.push(readLength);
    }
    
    // Step 2: 確実にカバーするための位置を計算
    const positions = [];
    
    // 最初のreadは位置0から
    positions[0] = 0;
    console.log(`Read 1: position 0, length ${readLengths[0]}, covers 0-${readLengths[0] - 1}`);
    
    // 各readを順次配置（確実にoverlapするように）
    for (let i = 1; i < numReads; i++) {
      const prevPos = positions[i - 1];
      const prevLength = readLengths[i - 1];
      const currentLength = readLengths[i];
      
      let newPos;
      
      if (i === numReads - 1) {
        // 最後のreadは必ず末尾をカバーする
        newPos = sequence.length - currentLength;
        console.log(`  Last read: target end position ${newPos} to cover sequence end`);
        
        // 前のreadとのoverlapを確保しつつ末尾をカバー
        const prevEnd = prevPos + prevLength;
        const maxAllowedPos = prevEnd - minOverlap;
        
        if (newPos > maxAllowedPos) {
          // 末尾をカバーするには overlap が不足する場合
          console.warn(`  Last read position ${newPos} would have insufficient overlap`);
          console.warn(`  Adjusting by extending last read or moving position`);
          
          // より長いreadにするか、位置を調整
          if (sequence.length - maxAllowedPos <= currentLength * 1.5) {
            // readを少し長くして対応
            readLengths[i] = sequence.length - maxAllowedPos;
            newPos = maxAllowedPos;
            console.log(`  Extended last read length to ${readLengths[i]}`);
          } else {
            // それでも不足する場合は強制的に末尾をカバー
            newPos = sequence.length - currentLength;
            console.warn(`  Forced last read to cover sequence end, overlap may be less than ideal`);
          }
        }
        
        // 最終的な位置調整
        newPos = Math.max(0, newPos);
        console.log(`  Final last read position: ${newPos}, will cover ${newPos}-${newPos + readLengths[i] - 1}`);
      } else {
        // 中間のreadは適切なoverlapを保ちつつ均等に配置
        const remainingReads = numReads - i;
        const remainingLength = sequence.length - (prevPos + prevLength - minOverlap);
        const stepSize = Math.floor(remainingLength / remainingReads);
        
        newPos = prevPos + prevLength - minOverlap + Math.max(1, stepSize - minOverlap);
        
        // 境界チェック
        const maxPos = prevPos + prevLength - minOverlap;
        const minPos = prevPos + Math.floor(prevLength * 0.3); // 30%以上進む
        
        newPos = Math.max(minPos, Math.min(newPos, maxPos));
        newPos = Math.min(newPos, sequence.length - currentLength);
      }
      
      positions[i] = Math.max(0, newPos);
      
      console.log(`Read ${i + 1}: position ${positions[i]}, length ${currentLength}, covers ${positions[i]}-${positions[i] + currentLength - 1}`);
      
      // Overlapをチェック
      const overlapStart = Math.max(positions[i - 1], positions[i]);
      const overlapEnd = Math.min(positions[i - 1] + readLengths[i - 1], positions[i] + currentLength);
      const actualOverlap = Math.max(0, overlapEnd - overlapStart);
      
      console.log(`  Overlap with read ${i}: ${actualOverlap}bp`);
      
      if (actualOverlap < 3) {
        console.warn(`  Warning: Insufficient overlap (${actualOverlap}bp) between reads ${i} and ${i + 1}`);
      }
    }
    
    // Step 3: readsを生成
    for (let i = 0; i < numReads; i++) {
      const position = positions[i];
      const readLength = readLengths[i]; // 調整済みの長さを使用
      const actualLength = Math.min(readLength, sequence.length - position);
      
      let readSeq = sequence.substring(position, position + actualLength);
      let isReverse = false;
      let hasError = false;
      
      console.log(`Creating read ${i + 1}: pos=${position}, targetLen=${readLength}, actualLen=${actualLength}`);
      console.log(`  Sequence: ${readSeq}`);
      
      // エラー導入（指定数のreadに）
      if (i < errorReads) {
        const originalSeq = readSeq;
        readSeq = introduceError(readSeq);
        hasError = true;
        console.log(`  Error introduced in read ${i + 1}: ${originalSeq} -> ${readSeq}`);
      }
      
      // リバースコンプリメント（指定数のreadに）
      if (i >= errorReads && i < errorReads + reverseReads) {
        const originalSeq = readSeq;
        readSeq = reverseComplement(readSeq);
        isReverse = true;
        console.log(`  Reverse complement for read ${i + 1}: ${originalSeq} -> ${readSeq}`);
      }
      
      reads.push({
        id: i,
        sequence: readSeq,
        originalStart: position,
        length: actualLength,
        isReverse,
        hasError,
        used: false
      });
    }
    
    // Step 4: カバレッジ検証
    const coverage = new Array(sequence.length).fill(0);
    reads.forEach((read, idx) => {
      const pos = positions[idx];
      for (let j = 0; j < read.length; j++) {
        if (pos + j < coverage.length) {
          coverage[pos + j]++;
        }
      }
    });
    
    const uncoveredPositions = coverage.map((c, i) => c === 0 ? i : -1).filter(p => p !== -1);
    if (uncoveredPositions.length > 0) {
      console.error(`Uncovered positions: ${uncoveredPositions}`);
      console.error(`Coverage array: ${coverage}`);
    } else {
      console.log(`✅ Full coverage achieved!`);
    }
    
    // シャッフル前の状態を記録
    console.log('Generated reads (before shuffle):');
    reads.forEach((read, i) => {
      console.log(`  Read ${i + 1}: ${read.sequence} (pos: ${positions[i]}, len: ${read.length})`);
    });
    
    // シャッフル
    return reads.sort(() => Math.random() - 0.5);
  };

  // overlap検出（逆鎖read対応版）
  const findBestOverlap = (seq1, seq2, minOverlap = 5) => {
    let bestOverlap = 0;
    let bestScore = 0;
    let useReverse = false;
    
    // 正鎖でのoverlap検出（seq2はすでに処理済み）
    for (let i = minOverlap; i <= Math.min(seq1.length, seq2.length); i++) {
      const suffix = seq1.slice(-i);
      const prefix = seq2.slice(0, i);
      
      if (suffix === prefix) {
        // 曖昧なoverlapかどうかをチェック
        const isAmbiguous = checkAmbiguousOverlap(suffix);
        if (!isAmbiguous) {
          // 曖昧でない場合のみ採用
          const score = i;
          if (score > bestScore) {
            bestOverlap = i;
            bestScore = score;
            useReverse = false;
          }
        }
      }
    }
    
    // さらにリバースコンプリメントを試す（レベル2以上）
    if (level >= 2) {
      const seq2Rev = reverseComplement(seq2);
      for (let i = minOverlap; i <= Math.min(seq1.length, seq2Rev.length); i++) {
        const suffix = seq1.slice(-i);
        const prefix = seq2Rev.slice(0, i);
        
        if (suffix === prefix) {
          const isAmbiguous = checkAmbiguousOverlap(suffix);
          if (!isAmbiguous) {
            const score = i;
            if (score > bestScore) {
              bestOverlap = i;
              bestScore = score;
              useReverse = true;
            }
          }
        }
      }
    }
    
    // 曖昧でないoverlapが見つからない場合、短いoverlapも許可
    if (bestOverlap === 0) {
      for (let i = 3; i < minOverlap; i++) {
        const suffix = seq1.slice(-i);
        const prefix = seq2.slice(0, i);
        
        if (suffix === prefix) {
          const isAmbiguous = checkAmbiguousOverlap(suffix);
          if (!isAmbiguous) {
            bestOverlap = i;
            bestScore = i * 0.5;
            useReverse = false;
            break;
          }
        }
      }
      
      // さらにリバースコンプリメントでも短いoverlapをチェック
      if (level >= 2 && bestOverlap === 0) {
        const seq2Rev = reverseComplement(seq2);
        for (let i = 3; i < minOverlap; i++) {
          const suffix = seq1.slice(-i);
          const prefix = seq2Rev.slice(0, i);
          
          if (suffix === prefix) {
            const isAmbiguous = checkAmbiguousOverlap(suffix);
            if (!isAmbiguous) {
              bestOverlap = i;
              bestScore = i * 0.5;
              useReverse = true;
              break;
            }
          }
        }
      }
    }
    
    return { overlap: bestOverlap, score: bestScore, useReverse };
  };

  // 曖昧なoverlapかどうかをチェック（改良版）
  const checkAmbiguousOverlap = (sequence) => {
    if (sequence.length <= 2) return true; // 3文字未満は曖昧
    
    // すべて同じ塩基かチェック（例：TTT、AAA）
    const firstBase = sequence[0];
    const allSame = sequence.split('').every(base => base === firstBase);
    if (allSame) return true;
    
    // 2文字の繰り返しかチェック（例：TATA、CGCG）
    if (sequence.length >= 4) {
      const pattern = sequence.slice(0, 2);
      let isRepeating = true;
      for (let i = 0; i < sequence.length; i += 2) {
        if (sequence.slice(i, i + 2) !== pattern) {
          isRepeating = false;
          break;
        }
      }
      if (isRepeating) return true;
    }
    
    return false;
  };

  // アセンブリアルゴリズム（逆鎖readの正しい処理）
  const assembleSequence = (readList) => {
    if (readList.length === 0) return '';
    if (readList.length === 1) {
      const read = readList[0];
      // 逆鎖readの場合はリバースコンプリメントして使用
      return read.isReverse ? reverseComplement(read.sequence) : read.sequence;
    }

    // 最初のreadを処理
    const firstRead = readList[0];
    let result = firstRead.isReverse ? reverseComplement(firstRead.sequence) : firstRead.sequence;
    let assemblyInfo = [
      `Read 1: ${firstRead.sequence} ${firstRead.isReverse ? '(3\'→5\', converted to: ' + reverseComplement(firstRead.sequence) + ')' : '(5\'→3\')'}`
    ];
    
    for (let i = 1; i < readList.length; i++) {
      const currentRead = readList[i];
      const currentSeq = currentRead.sequence;
      
      // 逆鎖readの場合はリバースコンプリメントしてからoverlapを検出
      const processedSeq = currentRead.isReverse ? reverseComplement(currentSeq) : currentSeq;
      const overlapInfo = findBestOverlap(result, processedSeq);
      
      if (overlapInfo.overlap > 0) {
        let nextSeq = processedSeq;
        
        // さらにリバースコンプリメントが必要な場合（overlapアルゴリズムが判断）
        if (overlapInfo.useReverse) {
          nextSeq = reverseComplement(processedSeq);
        }
        
        // overlapを除いて追加
        const newPart = nextSeq.slice(overlapInfo.overlap);
        result += newPart;
        
        const readInfo = currentRead.isReverse ? 
          `${currentSeq} (3'→5', converted to: ${processedSeq})` : 
          `${currentSeq} (5'→3')`;
        
        assemblyInfo.push(
          `Read ${i + 1}: ${readInfo}, overlap ${overlapInfo.overlap}bp${overlapInfo.useReverse ? ' (further reversed)' : ''}, added "${newPart}"`
        );
      } else {
        // overlapが見つからない場合、ギャップなしで単純連結
        const seqToAdd = processedSeq;
        result += seqToAdd;
        
        const readInfo = currentRead.isReverse ? 
          `${currentSeq} (3'→5', converted to: ${processedSeq})` : 
          `${currentSeq} (5'→3')`;
        
        assemblyInfo.push(`Read ${i + 1}: ${readInfo}, no valid overlap found, concatenated "${seqToAdd}"`);
      }
    }
    
    console.log('Assembly process:', assemblyInfo);
    return result;
  };

  // 類似度計算（エラー考慮版）
  const calculateSimilarity = (assembled, target) => {
    if (!assembled || !target) return 0;
    
    // ギャップ（N）を除去
    const cleanAssembled = assembled.replace(/N+/g, '');
    
    if (cleanAssembled.length === 0) return 0;
    
    // 1. 完全一致チェック
    if (cleanAssembled === target) return 1.0;
    
    // 2. エラーを考慮した類似度（レベル2,3用）
    if (level >= 2) {
      // 長さが大体合っているかチェック
      const lengthRatio = Math.min(cleanAssembled.length, target.length) / 
                         Math.max(cleanAssembled.length, target.length);
      
      if (lengthRatio < 0.8) return 0; // 長さが大きく異なる場合は失敗
      
      // 文字単位の一致率を計算
      let matches = 0;
      const minLength = Math.min(cleanAssembled.length, target.length);
      
      for (let i = 0; i < minLength; i++) {
        if (cleanAssembled[i] === target[i]) {
          matches++;
        }
      }
      
      const accuracy = matches / target.length;
      
      // エラーが1個までなら許容（95%以上の一致で成功とみなす）
      return accuracy;
    }
    
    // レベル1では完全一致のみ
    return 0;
  };

  // 成功判定
  const checkSuccess = (assembled, target) => {
    const similarity = calculateSimilarity(assembled, target);
    
    if (level === 1) {
      // レベル1は完全一致のみ
      return similarity >= 1.0;
    } else {
      // レベル2,3はエラー1個まで許容（95%以上の一致）
      return similarity >= 0.95;
    }
  };

  // ゲーム初期化
  const initGame = () => {
    const config = getLevelConfig(level);
    const newTarget = generateRealisticDNA(config.length);
    const newReads = generateReads(newTarget, config);
    
    setTargetSequence(newTarget);
    setReads(newReads);
    setSelectedReads(newReads); // 最初からすべて選択済み
    setAssembledSequence(''); // 初期状態では空
    setGameComplete(false);
    setReadMemos({});
    setShowMemoInput(null);
    
    // すべてのreadを使用済みにマーク
    const allUsedReads = newReads.map(r => ({...r, used: true}));
    setReads(allUsedReads);
  };

  // readを選択（使用しない - 最初からすべて選択済み）
  const selectRead = (read) => {
    // この関数は使用されません
  };

  // readの選択を解除（使用しない - すべて選択済み状態を維持）
  const removeRead = (readToRemove) => {
    // この関数は使用されません
  };

  // すべてのreadsがクリアされたかチェック
  const checkAllReadsUsed = () => {
    return reads.every(r => r.used);
  };

  // メモ機能
  const handleMemoChange = (readId, memo) => {
    setReadMemos(prev => ({
      ...prev,
      [readId]: memo
    }));
  };

  const toggleMemoInput = (readId) => {
    setShowMemoInput(showMemoInput === readId ? null : readId);
  };

  // ドラッグ&ドロップ機能
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSelectedReads = [...selectedReads];
    const draggedRead = newSelectedReads[draggedIndex];
    
    // 要素を削除して新しい位置に挿入
    newSelectedReads.splice(draggedIndex, 1);
    newSelectedReads.splice(dropIndex, 0, draggedRead);
    
    setSelectedReads(newSelectedReads);
    
    // 新しい順序でアセンブリを再計算
    const assembled = assembleSequence(newSelectedReads);
    setAssembledSequence(assembled);
    
    // 成功判定を即座に実行
    const success = checkSuccess(assembled, targetSequence);
    if (success) {
      setGameComplete(true);
      setScore(score + level * 150);
    } else {
      setGameComplete(false); // 失敗の場合は成功状態をリセット
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // リセット
  const reset = () => {
    // すべてのreadを使用済み状態で初期順序に戻す
    const resetReads = [...reads].sort((a, b) => a.id - b.id).map(r => ({...r, used: true}));
    setReads(resetReads);
    setSelectedReads(resetReads);
    setAssembledSequence('');
    setGameComplete(false);
  };

  // 次のレベル
  const nextLevel = () => {
    if (level < 3) {
      setLevel(level + 1);
    } else {
      setLevel(1);
    }
  };

  useEffect(() => {
    initGame();
  }, [level]);

  // 初回アセンブリ実行（selectedReadsが更新されたとき）
  useEffect(() => {
    if (selectedReads.length > 0) {
      const assembled = assembleSequence(selectedReads);
      setAssembledSequence(assembled);
      
      // 成功判定
      const success = checkSuccess(assembled, targetSequence);
      if (success) {
        setGameComplete(true);
        setScore(score + level * 150);
      } else {
        setGameComplete(false);
      }
    }
  }, [selectedReads, targetSequence]);

  const availableReads = reads.filter(r => !r.used);
  const config = getLevelConfig(level);
  const similarity = assembledSequence ? calculateSimilarity(assembledSequence, targetSequence) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-800 mb-2">
            🧬 ゲノムアセンブリチャレンジ
          </h1>
          <p className="text-gray-600">DNA断片から元の配列を復元しよう！</p>
          <div className="flex justify-center items-center gap-4 mt-4">
            <span className="bg-indigo-100 px-3 py-1 rounded-full text-sm font-semibold">
              レベル {level}: {config.description}
            </span>
            <span className="bg-green-100 px-3 py-1 rounded-full text-sm font-semibold">
              スコア: {score}
            </span>
          </div>
        </div>

        {/* レベル別説明 */}
        {showHints && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-800">レベル{level}の特徴</h3>
              <button 
                onClick={() => setShowHints(false)}
                className="ml-auto text-yellow-600 hover:text-yellow-800 text-sm"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-yellow-700 space-y-1">
              {level === 1 && (
                <>
                  <div>• 4個のreadで完全なアセンブリ（エラーなし、正鎖のみ）</div>
                  <div>• すべてのreadを使って完全一致を目指そう</div>
                  <div>• 重複部分を見つけて正しい順番に並べる</div>
                </>
              )}
              {level === 2 && (
                <>
                  <div>• 6個のreadでアセンブリ（エラー1個、逆鎖1個含む）</div>
                  <div>• ⚠️マークはシーケンシングエラー、↺は逆鎖read</div>
                  <div>• エラー1個まで許容、95%以上の一致で成功</div>
                  <div>• メモ機能を活用して整理しよう</div>
                </>
              )}
              {level === 3 && (
                <>
                  <div>• 6個のreadで長い配列（120bp）をアセンブリ</div>
                  <div>• エラー1個、逆鎖1個含む実践的なデータ</div>
                  <div>• より戦略的なアプローチが必要</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 統計情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-blue-700">{reads.length}</div>
            <div className="text-xs text-blue-600">Total Reads</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-green-700">{selectedReads.length}</div>
            <div className="text-xs text-green-600">Selected</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-purple-700">{targetSequence.length}</div>
            <div className="text-xs text-purple-600">Target Length</div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-orange-700">{Math.round(similarity * 100)}%</div>
            <div className="text-xs text-orange-600">Similarity</div>
          </div>
        </div>

        {/* 目標配列 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">目標配列</h3>
            <button
              onClick={() => setShowTarget(!showTarget)}
              className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              {showTarget ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTarget ? '隠す' : '表示'}
            </button>
          </div>
          <div className="font-mono text-sm bg-white p-3 rounded border">
            {showTarget ? (
              targetSequence.split('').map((base, i) => (
                <span
                  key={i}
                  className={`
                    font-bold
                    ${base === 'A' ? 'text-red-600' : ''}
                    ${base === 'T' ? 'text-blue-600' : ''}
                    ${base === 'G' ? 'text-green-600' : ''}
                    ${base === 'C' ? 'text-purple-600' : ''}
                  `}
                >
                  {base}
                </span>
              ))
            ) : (
              <span className="text-gray-400">？？？（{targetSequence.length}文字）</span>
            )}
          </div>
        </div>

        {/* 現在の結果 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">アセンブル結果</h3>
            <div className="text-sm text-gray-600">
              類似度: {Math.round(similarity * 100)}% | 長さ: {assembledSequence.length}
              {checkAllReadsUsed() && (
                <span className="ml-2 text-green-600 font-semibold">
                  {checkSuccess(assembledSequence, targetSequence) ? '✅ 成功!' : 
                   level === 1 ? '❌ 完全一致が必要' : '❌ 95%以上の一致が必要'}
                </span>
              )}
            </div>
          </div>
          <div className="font-mono text-sm bg-white p-3 rounded border min-h-[3rem] flex items-center overflow-x-auto">
            {assembledSequence ? (
              assembledSequence.split('').map((base, i) => (
                <span
                  key={i}
                  className={`
                    font-bold
                    ${base === 'A' ? 'text-red-600' : ''}
                    ${base === 'T' ? 'text-blue-600' : ''}
                    ${base === 'G' ? 'text-green-600' : ''}
                    ${base === 'C' ? 'text-purple-600' : ''}
                    ${base === 'N' ? 'text-gray-400 bg-gray-200' : ''}
                    ${checkAllReadsUsed() && checkSuccess(assembledSequence, targetSequence) ? 'bg-green-200' : 
                      checkAllReadsUsed() ? 'bg-red-200' : 
                      similarity >= 0.7 ? 'bg-yellow-200' : ''}
                  `}
                >
                  {base}
                </span>
              ))
            ) : (
              <span className="text-gray-400">DNA断片を選択してアセンブルを開始...</span>
            )}
          </div>
        </div>

        {/* 選択済みの断片 */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">
            DNA断片の配置（{selectedReads.length}個）- ドラッグで順番変更
          </h3>
          
          {selectedReads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {selectedReads.map((read, index) => (
                <div
                  key={`${read.id}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    relative cursor-move transition-all duration-200
                    ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
                    ${dragOverIndex === index ? 'transform translate-y-1' : ''}
                  `}
                >
                  <div className="w-full p-2 bg-green-200 rounded-lg font-mono text-xs border text-left">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Read {index + 1}</span>
                        <span className="text-xs text-blue-600 font-semibold">
                          {read.isReverse ? "3'→5' (逆鎖)" : "5'→3' (正鎖)"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {read.length}bp {read.hasError ? '⚠️' : ''} {read.isReverse ? '↺' : ''}
                      </span>
                    </div>
                    <div>
                      {read.sequence.split('').map((base, i) => (
                        <span
                          key={i}
                          className={`
                            font-bold
                            ${base === 'A' ? 'text-red-700' : ''}
                            ${base === 'T' ? 'text-blue-700' : ''}
                            ${base === 'G' ? 'text-green-700' : ''}
                            ${base === 'C' ? 'text-purple-700' : ''}
                          `}
                        >
                          {base}
                        </span>
                      ))}
                    </div>
                    {level >= 2 && (
                      <div className="mt-1 relative">
                        <button
                          onClick={() => toggleMemoInput(read.id)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                            readMemos[read.id] ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <StickyNote className="w-3 h-3" />
                          {readMemos[read.id] ? 'メモ編集' : 'メモ追加'}
                        </button>
                        {readMemos[read.id] && (
                          <div className="mt-1 px-2 py-1 bg-blue-100 rounded text-xs text-blue-800">
                            📝 {readMemos[read.id]}
                          </div>
                        )}
                        
                        {/* メモ入力 */}
                        {showMemoInput === read.id && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 p-2 bg-white border-2 border-blue-300 rounded-lg shadow-lg">
                            <input
                              type="text"
                              placeholder="メモ（例：左端候補、overlap 8bp）"
                              value={readMemos[read.id] || ''}
                              onChange={(e) => handleMemoChange(read.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  setShowMemoInput(null);
                                }
                              }}
                              onBlur={() => setTimeout(() => setShowMemoInput(null), 150)}
                              className="w-full text-xs px-2 py-1 border rounded focus:outline-none focus:border-blue-400"
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* ドラッグ中の視覚的フィードバック */}
                  {dragOverIndex === index && draggedIndex !== index && (
                    <div className="absolute inset-0 border-2 border-blue-400 border-dashed rounded-lg pointer-events-none bg-blue-100 bg-opacity-30" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
              DNA断片をドラッグで並び替えてアセンブリしましょう
            </div>
          )}
          
          {/* ドラッグ操作のヒント */}
          {selectedReads.length > 1 && (
            <div className="mt-4 text-xs text-gray-500 text-center">
              💡 DNA断片をドラッグして順番を変更し、正しい配列を作成しましょう
            </div>
          )}
          
          {/* 自動アセンブリ完了メッセージ */}
          {selectedReads.length > 0 && !gameComplete && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
              <div className="text-yellow-800 font-semibold">🧬 DNA断片を並び替えてアセンブリ中...</div>
              <div className="text-yellow-700 text-sm mt-1">
                {level === 1 ? 
                  '順番を調整して完全に一致する配列を作成しましょう' :
                  '順番を調整して95%以上の一致を目指しましょう（エラー1個まで許容）'
                }
              </div>
            </div>
          )}
        </div>

        {/* 成功メッセージ */}
        {gameComplete && (
          <div className="mb-6 p-4 bg-green-100 border-2 border-green-400 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold text-green-800">🎉 レベル{level}クリア！</h3>
            </div>
            <p className="text-green-700 mb-2">
              類似度{Math.round(similarity * 100)}%でDNA配列を復元しました！
            </p>
            <p className="text-green-600 text-sm mb-3">
              獲得スコア: {level * 150}点
            </p>
            <button
              onClick={nextLevel}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              {level < 3 ? `レベル${level + 1}へ進む` : 'レベル1へ戻る'}
            </button>
          </div>
        )}

        {/* コントロール */}
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            リセット
          </button>
          <button
            onClick={initGame}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            新しい問題
          </button>
        </div>

        {/* ヒント */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <h4 className="font-semibold mb-2">💡 コツ：</h4>
          <div className="space-y-1">
            <div>• <strong className="text-red-600">A</strong>=赤, <strong className="text-blue-600">T</strong>=青, <strong className="text-green-600">G</strong>=緑, <strong className="text-purple-600">C</strong>=紫</div>
            <div>• ⚠️ = シーケンシングエラー含む, ↺ = 逆鎖（リバースコンプリメント）</div>
            <div>• 5'→3'方向：正鎖DNAの標準的な読み取り方向</div>
            <div>• 3'→5'方向：逆鎖DNAの読み取り方向（リバースコンプリメント）</div>
            <div>• 逆鎖read：相補的な塩基に変換して逆向きにしたもの（例：ATGC → GCAT）</div>
            <div>• より長い非曖昧なoverlapを見つけることで正確なアセンブリができます</div>
            <div>• TTTやAAA等の同一塩基の繰り返しは曖昧なoverlapなので避けられます</div>
            <div>• すべてのreadを正しい順序で配置して目標配列を復元しよう</div>
            {level >= 2 && <div>• メモ機能を使って戦略的にアプローチしよう</div>}
            {level >= 2 && <div>• エラーがあるreadは完全一致しない場合があります</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenomeAssemblyGame;