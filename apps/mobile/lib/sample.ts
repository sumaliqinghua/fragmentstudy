import { createArticle, createCards, getArticles } from './dataService';
import type { CardSplitResult } from './types';

export const SAMPLE_ARTICLE_TITLE = '示例：如何开始读长文';

const SAMPLE_BODY = `深度学习是机器学习的一个分支，它通过构建多层的神经网络来模拟人脑的学习过程。

人工神经网络（Artificial Neural Network）的灵感来自生物学中的神经系统。其中最基本的计算单元被称为人工神经元或感知机（Perceptron）。每个神经元会对多个输入加权求和，并加入偏置，再通过激活函数产生输出。

在实际训练中，权重与偏置都是可学习参数。优化算法通过反向传播不断调整它们，使网络在任务上的误差逐渐下降。

若缺少非线性激活，多层线性变换可合并为单层，表达能力不会随深度增加。因此激活函数是深度模型的关键。

类比虽不精确，但有助于建立直觉：网络学习的过程，就是不断调整每位「评委」的信任度与默认立场。

下一章我们将把多个神经元叠成层，并讨论前向传播与反向传播如何协作完成学习。`;

const SAMPLE_CARDS: CardSplitResult[] = [
  {
    content:
      '人工神经网络的灵感源自大脑。其最基本的构建单元就是人工神经元 (Neuron)，也称感知机。\n\n每个神经元接收多个输入信号，将它们乘以相应的权重，再加上偏置，最后通过激活函数。没有激活函数的网络无论叠多少层，本质上仍是线性方程。',
    semantic_label: '核心原理',
    context_summary: '介绍神经元与感知机',
  },
  {
    content:
      '权重决定信号的重要性：大权重放大该输入，小权重则削弱它。偏置让模型可以平移决策边界，即使所有输入为 0 也能输出非零值。',
    semantic_label: '关键概念',
    context_summary: '权重与偏置',
  },
  {
    content:
      '激活函数引入非线性，使深层网络可以逼近复杂函数。常见选择包括 ReLU、Sigmoid 与 Tanh；现代网络多以 ReLU 及其变体为主。',
    semantic_label: '为什么要非线性',
    context_summary: '激活函数的作用',
  },
  {
    content:
      '把神经元想成一个「带偏好的加权投票器」：输入投票，权重是信任度，偏置是默认立场，激活函数决定最终是否通过。',
    semantic_label: '小练习',
    context_summary: '直觉类比',
  },
  {
    content: '神经元 = 加权求和 + 偏置 + 激活。掌握这一单元，就理解了神经网络的最小积木。',
    semantic_label: '本节小结',
    context_summary: '关卡收束',
  },
  {
    content:
      '训练时，反向传播根据误差逐层调整参数。学习率控制每一步更新的幅度——太大易震荡，太小则收敛缓慢。',
    semantic_label: '训练直觉',
    context_summary: '连接下一关',
  },
  {
    content:
      '把多个神经元排成一层，再把层叠起来，就得到「深度」网络。前向传播算预测，反向传播算梯度，两者协作完成学习。',
    semantic_label: '从单元到网络',
    context_summary: '第二关内容',
  },
  {
    content: '读长文也一样：先抓住最小积木（概念），再串成路径（关卡），每天只走一站，就会自然读完。',
    semantic_label: '迁移到学习',
    context_summary: '产品隐喻',
  },
];

/** Ensure guest (or empty account) has a playable sample material. */
export async function ensureSampleMaterial(): Promise<string | null> {
  const articles = await getArticles();
  const existing = articles.find((a) => a.title === SAMPLE_ARTICLE_TITLE);
  if (existing) return existing.id;

  const article = await createArticle(SAMPLE_ARTICLE_TITLE, SAMPLE_BODY, 'card', undefined, {
    sourceType: 'text',
  });
  await createCards(article.id, SAMPLE_CARDS);
  return article.id;
}

export { SAMPLE_BODY };
