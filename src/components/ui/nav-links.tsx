import React from 'react';

export function NavLinks() {
    return (
        <div className="hidden items-center gap-4 mr-4 md:flex">
            <a
                href={process.env.NEXT_PUBLIC_CLINIC_URL || 'https://qna.open-health.me/'}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
            >
                Clinic
            </a>
            <a
                href={process.env.NEXT_PUBLIC_QNA_URL || 'https://question.open-health.me/'}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
            >
                Q&A
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">NEW</span>
            </a>
            <a
                href={process.env.NEXT_PUBLIC_FEEDBACK_URL || 'https://tally.so/r/3xl2GE'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
            >
                Feedback
            </a>
            <a
                href={process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/OpenHealthForAll/open-health'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
            >
                Github
            </a>
            <a
                href={process.env.NEXT_PUBLIC_REDDIT_URL || 'https://www.reddit.com/r/AIDoctor/'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
            >
                Reddit
            </a>
            <a
                href={process.env.NEXT_PUBLIC_DISCORD_URL || 'https://discord.gg/B9K654g4wf'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
            >
                Discord
            </a>
        </div>
    );
}
