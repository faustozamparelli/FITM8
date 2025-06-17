```js
Navbar {
    home {
        top: [
            profile button on the left
            "new run" button on the right
        ]

        List(title: "Workouts you are hosting")
            map: upcoming events I created

        Floating Button on the Bottom(
            title: "Discover"
        ) onClick: {
            modal with swipe left/right view
            of events other people organized

            on swipe left: go on
            on swipe right: red bubble on chat navbar button
        }
    }

    chats (attending) {
        all events you are attending: both
        - the ones you organized
        - and the ones you are just attending
        [*]red dot for "new" chats
    }
}
```
