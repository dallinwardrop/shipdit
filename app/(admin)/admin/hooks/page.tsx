'use client'

import { useState } from 'react'

const CATEGORIES = [
  {
    title: 'Core Premise',
    hooks: [
      'I build whatever app the internet funds. Today someone paid $[X] for this.',
      'The internet picked today\'s app. [X] strangers funded it. I had 72 hours.',
      'Strangers on the internet pooled $[X] to build this app. I had to deliver.',
      'Someone I\'ve never met paid me $[X] to build their app idea. Here it is.',
      'I let the internet fund my next project. They chose this.',
      '[X] people paid $[X] to get this app built. Watch me ship it in 72 hours.',
      'The internet crowdfunded this app idea in [X] hours. I had 72 to build it.',
      'I only build apps people already paid for. Today\'s just hit $[X].',
      'This app was funded by [X] strangers before I wrote a single line of code.',
    ],
  },
  {
    title: 'Results/Proof',
    hooks: [
      'This app idea raised $[X] in [X] hours. I had 72 hours to build it or refund everyone.',
      '[X] strangers paid $[X] for this app before it existed. I had 72 hours to deliver.',
      'The dumbest app idea I\'ve ever seen just raised $[X]. I had no choice but to build it.',
      'Someone submitted this at midnight. By noon [X] people had funded it. I panicked.',
      'I took $[X] from [X] strangers on the internet. They gave me 72 hours. Here\'s what happened.',
      'This app had [X] paying users before I wrote a single line of code.',
      '[X] people paid me to build this. If I failed they all got refunded. I didn\'t fail.',
      'This idea went from submission to $[X] funded in [X] hours. Then I had to actually build it.',
      'The most funded app idea this week cost $[X] to build and is now free forever.',
    ],
  },
  {
    title: 'Curiosity/Concept',
    hooks: [
      'What if the app you wanted existed but nobody built it yet? We fix that.',
      'I only build apps people already paid for. The internet decides what\'s next.',
      'Apps cost millions to build. We do it for $[X] in 72 hours. Here\'s proof.',
      'The app store has 2 million apps. None of them are what you actually want. Until now.',
      'I\'ve never built an app nobody wanted because I get paid before I build.',
      'What if you could get any app built for $10? That\'s literally what this is.',
      'Every app I build is fully funded before I start. Here\'s how that works.',
      'This app didn\'t exist 72 hours ago. [X] people paid to make it real.',
      'The only apps I build are ones people already voted for with their wallets.',
    ],
  },
  {
    title: 'Challenge/Stakes',
    hooks: [
      'I took $[X] from [X] strangers. If I don\'t ship in 72 hours they all get refunded.',
      '[X] people are waiting for this app. I have 72 hours. Watch what happens.',
      '$[X] on the line. 72 hours. One app. This is what pressure looks like.',
      'If I don\'t ship by [time], everyone gets their money back. It\'s [time] now.',
      '[X] people funded this. I have 72 hours to deliver or lose everything.',
      'The funding just closed. $[X] raised. 72 hours on the clock. Let\'s go.',
      'I\'ve never missed a 72-hour deadline. Today might be the day that changes.',
      '[X] strangers just handed me $[X]. I have until [time] to deliver. No excuses.',
      'This is what it feels like to have [X] people depending on you to ship.',
    ],
  },
  {
    title: 'Behind the Build',
    hooks: [
      'Here\'s what building an app in 72 hours actually costs. The real numbers.',
      'Hour [X] of a 72-hour build. Here\'s exactly where I\'m at.',
      'I made [X] mistakes building this app. Here\'s what I\'d do differently.',
      'This is my screen at 3am on hour [X] of a 72-hour build. Worth it.',
      'The mistake that almost cost me $[X] in refunds on hour [X] of the build.',
      'What nobody tells you about shipping software in 72 hours.',
      'I\'ve built [X] apps in [X] days. Here\'s what I\'ve learned about building fast.',
      'This nearly broke me. Hour [X] of [X]. Almost missed the deadline.',
      'The moment I thought I was going to have to refund $[X] to [X] people.',
    ],
  },
  {
    title: 'Social Proof/Community',
    hooks: [
      'A nurse in Texas and a developer in London both paid for the same app idea. Wild.',
      'The top backer on this put in $[X]. I asked them why. Their answer surprised me.',
      '[X] people from [X] different countries funded this app that doesn\'t exist yet.',
      'This idea got [X] backers in [X] hours. I didn\'t see that coming.',
      '[X] people saw this app idea and immediately put money down. No hesitation.',
      'Someone submitted this idea. [X] strangers agreed it needed to exist. I built it.',
      'The person who submitted this put in $[X] of their own money first. That\'s conviction.',
      '[X] backers. [X] countries. One app idea. This is what community looks like.',
      'This app had [X] paying users before the first line of code was written.',
    ],
  },
  {
    title: 'Contrast/Disruption',
    hooks: [
      'VCs said no to ideas like this [X] times. [X] regular people just funded it in [X] hours.',
      'Startups spend $[X]M validating ideas. We do it for $[X] in 72 hours.',
      'The VC model is broken. Here\'s what app funding looks like when regular people decide.',
      'Silicon Valley wouldn\'t touch this idea. [X] real people funded it overnight.',
      'Most apps are built hoping someone wants them. Every app I build is pre-sold.',
      'The app store has 2 million apps nobody asked for. Every app here was requested and paid for.',
      'Traditional app development takes 18 months. We shipped this in 72 hours.',
      'A startup would\'ve spent $[X]M building this. We did it for $[X].',
      'No pitch deck. No investors. Just [X] people who wanted this built and paid first.',
    ],
  },
  {
    title: 'Specific App Hooks',
    hooks: [
      'Someone paid me to build an app that ranks Barry\'s Bootcamp locations by vibe. I built it.',
      'The most niche app idea I\'ve ever seen just raised $[X]. [X] people really needed this.',
      'I didn\'t know this many people cared about [specific thing] until [X] of them paid for an app.',
      'This app solves a problem most people don\'t even know they have. [X] people knew.',
      'The weirdest app idea I\'ve ever built launched today and already has [X] users.',
      'Someone had a very specific problem. Turns out [X] other people had the exact same one.',
      'I thought this idea was too niche. [X] paying users proved me wrong in [X] hours.',
      'This app is for one very specific type of person. [X] of them found it immediately.',
      'Only [X] people in the world need this app. All [X] of them funded it.',
    ],
  },
  {
    title: 'Naming & Easter Egg Perks',
    hooks: [
      'I let a stranger name this app I built. Here\'s what they chose.',
      'The person who funded this app the most got to name it. Here\'s what they picked.',
      'I built an app and let the top backer name it. The name they chose is wild.',
      'Someone paid $[X] and got to hide a secret easter egg inside this app. Here\'s what it is.',
      'The #1 backer on this app got to name it whatever they wanted. No restrictions.',
      'I built an app for [X] strangers. The one who paid the most got to name it. Here\'s the name.',
      'Someone funded this app just to hide a secret message inside it that only they know about.',
      'The top backer chose the name. The second backer hid an easter egg. Here\'s both.',
      'I let strangers name my apps. This is the best name anyone has ever chosen.',
    ],
  },
  {
    title: 'Call to Action',
    hooks: [
      'What app do you wish existed right now? Drop it. Most liked gets built this week.',
      'Comment your app idea. If it gets [X] likes I\'ll put it in the fund queue today.',
      'I build whatever the internet funds next. What should it be? Comment below.',
      'The next app gets picked in [X] hours. What do you want built? You decide.',
      'Drop your app idea. If [X] people agree it needs to exist I\'ll build it in 72 hours.',
      'What\'s an app you\'d pay $10 for right now? Tell me. I\'m actually building the top answer.',
      'Your idea could be live in 72 hours. What app do you wish existed?',
      'I read every comment. Drop your app idea. The most wanted one gets built next.',
      'What app would you fund right now if you could? I\'m taking submissions today.',
    ],
  },
]

const btnBase: React.CSSProperties = {
  fontFamily: 'Share Tech Mono, monospace',
  fontSize: 11,
  cursor: 'pointer',
  padding: '2px 8px',
  background: '#c0c0c0',
  border: '2px solid',
  borderColor: '#fff #808080 #808080 #fff',
}

function HookRow({ hook }: { hook: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(hook).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '5px 0',
        borderBottom: '1px solid #d8d8d8',
      }}
    >
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, flex: 1, lineHeight: 1.5 }}>
        {hook}
      </span>
      <button
        onClick={handleCopy}
        style={{
          ...btnBase,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          ...(copied ? { borderColor: '#808080 #fff #fff #808080', background: '#a0c0a0' } : {}),
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function HooksPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">TikTok Hooks</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>TIKTOK HOOKS</h1>
          <p className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
            {CATEGORIES.length} categories · {CATEGORIES.reduce((n, c) => n + c.hooks.length, 0)} hooks total
          </p>
        </div>
      </div>

      {CATEGORIES.map((cat, i) => (
        <div key={cat.title} className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">{i + 1}. {cat.title}</span>
            <span className="text-xs opacity-60 ml-2">({cat.hooks.length})</span>
          </div>
          <div className="p-3">
            {cat.hooks.map((hook, j) => (
              <HookRow key={j} hook={hook} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
