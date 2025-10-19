document.addEventListener('DOMContentLoaded', () => {
    const cursorLeader = document.querySelector('.cursor-leader');

    document.addEventListener('mousemove', e => {
        cursorLeader.style.top = (e.clientY - 10) + 'px';
        cursorLeader.style.left = (e.clientX - 10) + 'px';
    });

    document.addEventListener('click', () => {
        cursorLeader.classList.add('expand');
        setTimeout(() => {
            cursorLeader.classList.remove('expand');
        }, 500);
    });

    const target = document.querySelectorAll('a');
    const secondTarget = document.querySelectorAll('.button');
    const thirdTarget = document.querySelectorAll('.skills-header');
    const fourthTarget = document.querySelectorAll('.work-item');
    const fifthTarget = document.querySelectorAll('.services-button');
    const sixthTarget = document.querySelectorAll('.services-modal-close');
    const seventhTarget = document.querySelectorAll('.contact-button');
    const eighthTarget = document.querySelectorAll('.work-button');
    const ninethTarget = document.querySelectorAll('.portfolio-popup-close');

    // Combine both NodeLists into one array
    const allTargets = [...target, ...secondTarget, ...thirdTarget, ...fourthTarget, ...fifthTarget, ...sixthTarget, ...seventhTarget, ...eighthTarget, ...ninethTarget];

    allTargets.forEach(el => {
        el.addEventListener('mouseover', () => cursorLeader.classList.add('active'));
        el.addEventListener('mouseout', () => cursorLeader.classList.remove('active'));
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const cursorFollower = document.querySelector('.cursor-follower');

    document.addEventListener('mousemove', e => {
        cursorFollower.style.top = (e.clientY - 10) + 'px';
        cursorFollower.style.left = (e.clientX - 10) + 'px';
    });

    document.addEventListener('click', () => {
        cursorFollower.classList.add('expand');
        setTimeout(() => {
            cursorFollower.classList.remove('expand');
        }, 500);
    });
});
