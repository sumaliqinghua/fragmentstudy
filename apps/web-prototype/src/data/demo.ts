export type PathNodeKind = 'stop' | 'chest';
export type PathNodeStatus = 'done' | 'current' | 'locked' | 'opened';

export interface PathNode {
  id: string;
  kind: PathNodeKind;
  status: PathNodeStatus;
  label: string;
  actionLabel?: string;
  number?: number;
}

export interface CardItem {
  id: string;
  label: string;
  paragraphs: string[];
  highlight?: string;
  originalExcerpt: string;
}

export interface Material {
  id: string;
  title: string;
  path: PathNode[];
  stopTitle: string;
  cards: CardItem[];
  originalBody: string;
}

export const sampleMaterial: Material = {
  id: 'sample-long-read',
  title: '示例：如何开始读长文',
  stopTitle: '第 2 关：神经元结构',
  path: [
    { id: 's1', kind: 'stop', status: 'done', label: '试学第 1 站', number: 1 },
    {
      id: 's2',
      kind: 'stop',
      status: 'current',
      label: '试学第 2 站',
      number: 2,
      actionLabel: '开始试学',
    },
    { id: 's3', kind: 'stop', status: 'locked', label: '试学第 3 站', number: 3 },
    { id: 'chest1', kind: 'chest', status: 'locked', label: '礼物宝箱' },
    { id: 's4', kind: 'stop', status: 'locked', label: '试学第 4 站', number: 4 },
  ],
  cards: [
    {
      id: 'c1',
      label: '核心原理',
      paragraphs: [
        '人工神经网络的灵感源自大脑。其最基本的构建单元就是人工神经元 (Neuron)，也称感知机。',
        '每个神经元接收多个输入信号，将它们乘以相应的权重（Weights），再加上偏置（Bias），最后通过一个非线性的激活函数。',
        '没有激活函数的神经网络，无论叠多少层，本质上依然只是线性方程，无法解决复杂的现实问题。',
      ],
      highlight: '人工神经元',
      originalExcerpt:
        '人工神经网络（Artificial Neural Network）的灵感来自生物学中的神经系统。其中最基本的计算单元被称为人工神经元或感知机（Perceptron）。每个神经元会对多个输入加权求和，并加入偏置，再通过激活函数产生输出。',
    },
    {
      id: 'c2',
      label: '关键概念',
      paragraphs: [
        '权重决定信号的重要性：大权重放大该输入，小权重则削弱它。',
        '偏置让模型可以平移决策边界，即使所有输入为 0 也能输出非零值。',
      ],
      originalExcerpt:
        '在实际训练中，权重与偏置都是可学习参数。优化算法通过反向传播不断调整它们，使网络在任务上的误差逐渐下降。',
    },
    {
      id: 'c3',
      label: '为什么要非线性',
      paragraphs: [
        '激活函数引入非线性，使深层网络可以逼近复杂函数。',
        '常见选择包括 ReLU、Sigmoid 与 Tanh；现代网络多以 ReLU 及其变体为主。',
      ],
      originalExcerpt:
        '若缺少非线性激活，多层线性变换可合并为单层，表达能力不会随深度增加。因此激活函数是深度模型的关键。',
    },
    {
      id: 'c4',
      label: '小练习',
      paragraphs: [
        '把神经元想成一个「带偏好的加权投票器」：输入投票，权重是信任度，偏置是默认立场，激活函数决定最终是否通过。',
      ],
      originalExcerpt:
        '类比虽不精确，但有助于建立直觉：网络学习的过程，就是不断调整每位「评委」的信任度与默认立场。',
    },
    {
      id: 'c5',
      label: '本节小结',
      paragraphs: [
        '神经元 = 加权求和 + 偏置 + 激活。掌握这一单元，就理解了神经网络的最小积木。',
      ],
      originalExcerpt:
        '下一章我们将把多个神经元叠成层，并讨论前向传播与反向传播如何协作完成学习。',
    },
  ],
  originalBody: `深度学习是机器学习的一个分支，它通过构建多层的神经网络来模拟人脑的学习过程。

人工神经网络（Artificial Neural Network）的灵感来自生物学中的神经系统。其中最基本的计算单元被称为人工神经元或感知机（Perceptron）。每个神经元会对多个输入加权求和，并加入偏置，再通过激活函数产生输出。

在实际训练中，权重与偏置都是可学习参数。优化算法通过反向传播不断调整它们，使网络在任务上的误差逐渐下降。

若缺少非线性激活，多层线性变换可合并为单层，表达能力不会随深度增加。因此激活函数是深度模型的关键。

类比虽不精确，但有助于建立直觉：网络学习的过程，就是不断调整每位「评委」的信任度与默认立场。

下一章我们将把多个神经元叠成层，并讨论前向传播与反向传播如何协作完成学习。`,
};

export const libraryItems = [
  {
    id: sampleMaterial.id,
    title: sampleMaterial.title,
    progress: '第 2 / 4 关',
    status: '进行中' as const,
  },
];
