//Storing Id and class into a variable to use.
const toggleButton = document.getElementById('toggle-btn') //Button that opens/close sidebar
const sidebar = document.getElementById('sidebar') //Sibar container
const button = document.getElementById('dropdown-btn') //dropdown button
const addDropdownBtn = document.getElementById("add-dropdown"); //adding a new dropdown menu (Device)
const sidebarList = document.querySelector("#sidebar ul");  //<ul> used in the siebar
const miniMenu = document.getElementById("add-menu");

document.addEventListener("dblclick", function (e) {
    if (e.target.classList.contains("menu-title")) {
        makeEditable(e.target);
    }
});

function makeEditable(span) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = span.textContent;
    input.classList.add("edit-input");
    span.replaceWith(input);
    input.select();

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveEdit(input);
    });
    input.addEventListener("blur", () => saveEdit(input));
}

function saveEdit(input) {
    const newSpan = document.createElement("span");
    newSpan.classList.add("menu-title");
    newSpan.textContent = input.value.trim() || "Untitled Menu";
    input.replaceWith(newSpan);
}

function toggleSidebar() {
    sidebar.classList.toggle('close');
    toggleButton.classList.toggle('rotate');

    Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
        ul.classList.remove('show');
        ul.previousElementSibling.classList.remove('rotate');
    });
}

function toggleSubMenu(button) {
    button.nextElementSibling.classList.toggle('show');
    button.classList.toggle('rotate');

    if (sidebar.classList.contains('close')) {
        sidebar.classList.toggle('close');
        toggleButton.classList.toggle('rotate');
    }
}