import "core-js/stable";
const _ = require("lodash");
import { randomId } from "./helpers";
import { PRIORITY_LOW, PRIORITY_MEDIUM, PRIORITY_HIGH } from "./config";

export const state = initData();

export function getTasks() {
  let tasks;
  if (state.currentCategory.id === "general") {
    tasks = state.tasks;
  } else {
    tasks = {};
    for (const taskStatus in state.tasks) {
      tasks[taskStatus] = state.tasks[taskStatus].filter(
        (task) => task.category.id === state.currentCategory.id
      );
    }
  }
  return _.cloneDeep(tasks);
}

export function addNewTask(data) {
  const task = {
    id: generateTaskId(),
    title: data.title,
    description: data.description,
    priority: data["priority-level"],
    status: "todo",
    dueDate: data["due-date"],
    keywords: getTaskKeywords(data.keywords),
    category: {
      id: data.category,
      name: data.category.replace(/[-]/g, " "),
    },
  };

  state.tasks[task.status].push(task);
  // Update persistent data
  storeData(state);
}

export function updateTask(task) {
  const currentTask = state.tasks[task.oldStatus].find((t) => t.id == task.id);

  currentTask.title = task.title;
  currentTask.description = task.description;
  currentTask.priority = task["priority-level"];
  currentTask.status = task.status;
  currentTask.dueDate = task["due-date"];
  currentTask.keywords = getTaskKeywords(task.keywords);
  currentTask.category = {
    id: task.category,
    name: task.category.replace(/[-]/g, " "),
  };

  if (task.oldStatus != task.status) {
    updateTaskStatus(currentTask, task.oldStatus, task.status);
  } else {
    // Update persistent data
    storeData(state);
  }
}

export function updateTaskStatus(task, fromStatus, toStatus) {
  // In case task is the task id get the task and update its status
  if (typeof task !== "object") {
    task = state.tasks[fromStatus].find((t) => t.id == task);
    task.status = toStatus;
  }

  // Remove the task from the old status array
  const taskIndex = state.tasks[fromStatus].findIndex((t) => t.id == task.id);
  state.tasks[fromStatus].splice(taskIndex, 1);

  // Add it to the current status arry
  state.tasks[toStatus].push(task);

  // Update persistent data
  storeData(state);
}

export function deleteTask(task) {
  const taskIndex = state.tasks[task.status].findIndex((t) => t.id == task.id);
  state.tasks[task.status].splice(taskIndex, 1);
  // Update persistent data
  storeData(state);
}

export function sortTasks(tasks) {
  for (const key in tasks) {
    tasks[key].sort((a, b) => {
      let val = 0;
      //  To make sorting be based on the criterion and its order
      for (const criterion of state.actions.sort) {
        const { field, value } = criterion;
        const aVal = a[field];
        const bVal = b[field];

        if (field == "dueDate") {
          val =
            value == "asc"
              ? new Date(aVal) - new Date(bVal)
              : new Date(bVal) - new Date(aVal);
        } else if (field == "title") {
          val =
            value == "asc"
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
        } else {
          val = value == "asc" ? aVal - bVal : bVal - aVal;
        }

        if (val !== 0) return val;
      }
      return val;
    });
  }
  return tasks;
}

export function filterTasks(tasks) {
  state.actions.filter.forEach((criterion) => {
    for (const key in tasks) {
      tasks[key] = tasks[key].filter((item) => {
        if (criterion.field == "priority") {
          return item[criterion.field] == criterion.value;
        }

        if (criterion.field == "dueDate") {
          const taskDueDate = new Date(item[criterion.field]);
          const startDate = new Date(criterion.value.split(",")[0]);
          const endDate = new Date(criterion.value.split(",")[1]);
          return taskDueDate >= startDate && taskDueDate <= endDate;
        }

        if (criterion.field == "keywords") {
          let flag = false;
          const keywords = criterion.value.split(",");
          keywords.forEach((keyword) => {
            item[criterion.field].forEach((k) => {
              if (k.toLowerCase() == keyword.toLowerCase()) {
                flag = true;
              }
            });
          });
          return flag;
        }
      });
    }
  });
  return tasks;
}

export function findTasks(tasks, searchedTerm, field) {
  let results = [];

  // DON'T use 'g' Flag here beacuse it'll change the test() behaviour
  const exp = new RegExp(searchedTerm.trim(), "i");
  for (const key in tasks) {
    results[key] = tasks[key].filter((item) => exp.test(item[field]));
  }
  return results;
}

export function deleteFilterKeyword(keyword) {
  state.actions["filter"].forEach((filter) => {
    if (filter.field == "keywords") {
      let keywords = filter.value.split(",");
      keywords = keywords.filter((k) => k != keyword);
      if (keywords.length == 0) {
        criterionIndx = state.actions["filter"].findIndex(
          (f) => f.field == "keywords"
        );
        state.actions["filter"].splice(criterionIndx, 1);
      } else {
        filter.value = keywords.join(",");
      }
    }
  });
  // Update persistent data
  storeData(state);
}

export function updateCurrentCategory(action) {
  state.currentCategory = state.categories.find(
    (cat) => cat.id === action.value
  );
  // Update persistent data
  storeData(state);
}

export function updateCriteria(action) {
  // Get the criterion
  const existingCriterion = findCriterion(
    state.actions[action.name],
    action.field
  );

  let criterionRemoved = false;

  // Handle the existing criterion  [Updating its value with a new value or Removing it.]
  if (existingCriterion) {
    criterionRemoved = handleExistingCriterion(existingCriterion, action);
  }

  // Adding new criterion
  if (!existingCriterion) addCriterion(action);

  // Update stored data
  storeData(state);

  return criterionRemoved;
}

export function addNewCategory(data) {
  const category = {
    id: data.name.split(" ").join("-"),
    name: data.name,
  };

  state.categories.push(category);
  // Update persistent data
  storeData(state);
}

export function deleteCategory(action) {
  const categoryIndx = state.categories.findIndex((c) => c.id === action.value);
  state.categories.splice(categoryIndx, 1);
  for (const [key, tasks] of Object.entries(state.tasks)) {
    state.tasks[key] = tasks.filter((t) => t.category.id !== action.value);
  }
  state.currentCategory = { id: "general", name: "general" };
  storeData(state);
}

function findCriterion(criteria, field) {
  return criteria.find((criterion) => criterion.field === field);
}
function handleExistingCriterion(criterion, action) {
  const shouldRemove = isRemovableCriterion(criterion, action);

  if (shouldRemove) {
    removeCriterion(action.name, action.field);
    return true;
  }

  updateCriterionValue(criterion, action);
  return false;
}
function isRemovableCriterion(criterion, action) {
  return (
    (criterion.field !== "keywords" && criterion.value === action.value) ||
    (action.name === "filter" &&
      (action.field === "dueDate" || action.field === "keywords") &&
      action.value === "clear")
  );
}
function updateCriterionValue(criterion, action) {
  if (action.name === "filter" && action.field === "keywords") {
    criterion.value = criterion.value
      ? `${criterion.value},${action.value}`
      : action.value;
  } else {
    criterion.value = action.value;
  }
}
function removeCriterion(actionName, actionField) {
  state.actions[actionName] = state.actions[actionName].filter(
    (cri) => cri.field != actionField
  );
  return true;
}
function addCriterion(action) {
  state.actions[action.name].push({
    field: action.field,
    value: action.value,
  });
}

function generateTaskId() {
  // Generate random id consists of 6 chrachters
  return randomId(6);
}
function getTaskKeywords(str) {
  const arr = str.trim("").split(",");
  const arr2 = [];
  let i = 0;
  // Maximum 3 Keyword
  while (i <= 2 && i < arr.length) {
    const k = arr[i].replace(/^'+|'+$/g, "").trim("");
    if (k == "") {
      arr.splice(i, 1);
      continue;
    }
    arr2.push(k);
    i++;
  }
  return arr2;
}
function storeData(data = undefined) {
  // Data Placeholder or Temp Data
  if (!data) {
    data = {
      tasks: {
        todo: [
          {
            id: 1,
            title: "Web Development Project",
            description:
              "This project is an extensive endeavor that encompasses the intricate process of developing a website from scraolve-04-14s crafting a digital space that not only showcases information but also provides functionality and interactivity to usonce-04-14ptualization to execution, every criterion in the journey of creating this website demands meticulous attention to detail and a deep understanding of various web development technologies and methodologvelo-04-14pment team will need to collaborate closely, leveraging their expertise in CSS, HTML, and JavaScript to bring the vision to lerar-04-14ching goal is to deliver a seamlessly navigable, visually captivating, and technically robust website that meets the client's requirements and exceeds user expectations.",
            priority: PRIORITY_HIGH,
            status: "todo",
            category: {
              id: "web-development",
              name: "Web Development",
            },
            dueDate: "2024-05-13",
            keywords: ["css", "html", "js"],
          },
          {
            id: 2,
            title: "Design Landing Page",
            description:
              "The task at hand involves creating a visually stunning and engaging landing page design that serves as the gateway to the websivat-04-14ing landing page is essential for making a strong first impression on visitors and enticing them to explore furtesig-04-14n endeavor requires meticulous attention to detail, as every element, from the layout to the color scheme, plays a crucial role in shaping the user experiesign-04-14 team will need to leverage their creativity and expertise in tools like Figma to craft a design that not only reflects the brand identity but also effectively communicates the desired message to the target audieive -04-14refinement and feedback incorporation are integral parts of the design process to ensure the final product aligns with the project objectives and exceeds expectations.",
            priority: PRIORITY_MEDIUM,
            status: "todo",
            category: {
              id: "design",
              name: "Design",
            },
            dueDate: "2024-05-19",
            keywords: ["figma", "ui"],
          },
          {
            id: 3,
            title: "Application Enhancement",
            description:
              "This task involves enhancing the functionality and user experience of the Dutyify application, a critical component of the project ecosysject-04-14ive is to identify areas for improvement and implement enhancements that address user pain points, streamline workflows, and introduce new features to stay competitive in the marging-04-14 their expertise in JavaScript and app development, the development team will collaborate to implement these enhancements effectively and efficienthe -04-14importance of this task, a sense of urgency is warranted to ensure timely delivery and maximum impact on user satisfaction and business success.",
            priority: PRIORITY_LOW,
            status: "todo",
            category: {
              id: "dutyify-application",
              name: "Dutyify Application",
            },
            dueDate: "2024-06-14",
            keywords: ["js", "apps", "urgent"],
          },
          {
            id: 7,
            title: "Testing Environment Setup",
            description:
              "In order to ensure the reliability and stability of the system, it is imperative to establish a robust testing environment for automated testnvol-04-14ves configuring the necessary infrastructure, selecting appropriate testing tools and frameworks, and implementing automated test scripts to validate the functionality and performance of the softwstin-04-14g team will work closely with the development team to set up a comprehensive testing suite that covers all aspects of the application, including unit testing and integration testesti-04-14ng time and resources in establishing a solid testing infrastructure, we can detect and address defects early in the development lifecycle, ultimately delivering a higher quality product to our users.",
            priority: PRIORITY_LOW,
            status: "todo",
            category: {
              id: "testing",
              name: "Testing",
            },
            dueDate: "2024-05-24",
            keywords: ["unit-testing", "integration-testing"],
          },
          {
            id: 8,
            title: "E-commerce Website Design",
            description:
              "The task at hand involves designing an e-commerce website with user-friendly interfaces that facilitate seamless browsing, product discovery, and checkout experienessf-04-14ul e-commerce design should not only be visually appealing but also intuitive and conversion-focused, driving users to take desired actions and ultimately make purchasign-04-14 team will need to leverage their expertise in UI/UX design principles, along with insights from user research and industry best practices, to create a design that not only meets but exceeds user expectatiorat-04-14ion with stakeholders and iterative design iterations will be key to refining the design and ensuring alignment with business goals and user needs.",
            priority: PRIORITY_MEDIUM,
            status: "todo",
            category: {
              id: "web-development",
              name: "Web Development",
            },
            dueDate: "2024-05-05",
            keywords: ["ui", "ux", "ecommerce"],
          },
          {
            id: 13,
            title: "API Documentation",
            description:
              "Creating comprehensive documentation for the APIs is crucial for facilitating integration and usage by developers, both internally and externaI do-04-14cumentation should provide clear and concise instructions on how to interact with the APIs, including endpoints, request/response formats, authentication mechanisms, and usage examponal-04-14ly, it should cover any relevant usage policies, versioning strategies, and best practices to ensure smooth integration and minimize developer frictcume-04-14ntation team will collaborate with the development team to gather necessary information and ensure accuracy and completeness of the documentatesti-04-14ng in well-documented APIs, we can empower developers to leverage our platform effectively, fostering innovation and driving ecosystem growth.",
            priority: PRIORITY_LOW,
            status: "todo",
            category: {
              id: "documentation",
              name: "Documentation",
            },
            dueDate: "2024-05-04",
            keywords: ["api", "documentation"],
          },
          {
            id: 14,
            title: "SEO Optimization",
            description:
              "Optimizing the website for better search engine ranking is a multifaceted task that involves implementing various strategies to improve visibility and organic trafnclu-04-14des keyword research, on-page optimization, technical SEO enhancements, and off-page SEO tactics such as link building and content promotO te-04-14am will work closely with the development and content teams to identify optimization opportunities and implement changes that align with search engine algorithms and user intuous-04-14 monitoring and analysis of key performance indicators will inform ongoing optimization efforts, ensuring sustainable growth in search engine visibility and driving targeted traffic to the website.",
            priority: PRIORITY_MEDIUM,
            status: "todo",
            category: {
              id: "marketing",
              name: "Marketing",
            },
            dueDate: "2024-05-14",
            keywords: ["seo", "search-engine", "optimization"],
          },
        ],
        inProgress: [
          {
            id: 4,
            title: "Mobile App Development",
            description:
              "Developing a mobile application for Android and iOS platforms is a complex undertaking that requires expertise in cross-platform development frameworks and mobile app design principal i-04-14s to create a seamless and intuitive user experience that leverages the unique capabilities of each platform while maintaining consistency across devivelo-04-14pment team will utilize technologies such as React Native and Flutter to build the app's frontend, while integrating with backend services to ensure data synchronization and real-time functionaluous-04-14 testing and refinement are integral parts of the development process, as we strive to deliver a polished and high-quality app that delights users and meets business objectives.",
            priority: PRIORITY_HIGH,
            status: "inProgress",
            category: {
              id: "mobile-development",
              name: "Mobile Development",
            },
            dueDate: "2024-04-28",
            keywords: ["react-native", "flutter", "mobile"],
          },
          {
            id: 5,
            title: "Graphic Design Project",
            description:
              "Creating graphics for marketing materials requires a combination of creativity, technical skill, and an understanding of brand identity and messagr de-04-14signing social media graphics, advertising materials, or promotional assets, the goal is to captivate and engage the audience while effectively communicating the intended messsign-04-14 team will leverage tools like Photoshop and Illustrator to bring concepts to life, experimenting with color palettes, typography, and imagery to achieve the desired visual imporat-04-14ion with stakeholders and feedback incorporation are essential to ensure the final deliverables align with brand guidelines and resonate with the target audience.",
            priority: PRIORITY_LOW,
            status: "inProgress",
            category: {
              id: "design",
              name: "Design",
            },
            dueDate: "2024-04-28",
            keywords: ["photoshop", "illustrator"],
          },
          {
            id: 6,
            title: "Backend API Development",
            description:
              "Developing APIs for the backend of the system is a foundational task that underpins the functionality and interoperability of the entire application ecosysIs s-04-14erve as the bridge between the frontend user interface and the underlying data and business logic, enabling seamless communication and data exchaging-04-14 technologies such as Node.js, Express, and MongoDB, the development team will design and implement APIs that are scalable, secure, and performgh t-04-14esting and documentation are essential to ensure the reliability and usability of the APIs, empowering frontend developers and third-party integrators to build on top of our platform with confidence.",
            priority: PRIORITY_MEDIUM,
            status: "inProgress",
            category: {
              id: "backend-development",
              name: "Backend Development",
            },
            dueDate: "2024-04-28",
            keywords: ["nodejs", "express", "mongodb"],
          },
          {
            id: 9,
            title: "Database Schema Design",
            description:
              "Designing the schema for the database is a critical task that lays the foundation for data organization, storage, and retrieval within the systaba-04-14se schema defines the structure of tables, relationships between entities, and constraints that ensure data integrity and consisteging-04-14 expertise in database design principles and SQL, the development team will design a schema that meets the requirements of the application, optimizing for performance, scalability, and maintainabilorat-04-14ion with stakeholders and thorough validation through testing are essential to ensure the adequacy and effectiveness of the database design, setting the stage for a robust and reliable system.",
            priority: PRIORITY_HIGH,
            status: "inProgress",
            category: {
              id: "database",
              name: "Database",
            },
            dueDate: "2024-04-28",
            keywords: ["database", "sql", "schema"],
          },
        ],
        completed: [
          {
            id: 10,
            title: "Content Management System Implementation",
            description:
              "Implementing a Content Management System (CMS) is a strategic initiative aimed at empowering content creators and streamlining the content publishing proctral-04-14izing content management and providing intuitive editing tools, a CMS enables efficient content creation, organization, and delivery across digital channging-04-14 platforms like WordPress and Drupal, the development team will customize and configure the CMS to meet the specific needs and requirements of the projrain-04-14ing and documentation will accompany the implementation to ensure smooth adoption and effective utilization of the CMS by content creators and administrators.",
            priority: PRIORITY_MEDIUM,
            status: "completed",
            category: {
              id: "web-development",
              name: "Web Development",
            },
            dueDate: "2024-04-22",
            keywords: ["wordpress", "drupal", "cms"],
          },
          {
            id: 11,
            title: "User Interface Refinement",
            description:
              "Refining the user interface based on user feedback is an iterative process aimed at enhancing usability, accessibility, and overall user satisfactheri-04-14ng and analyzing user feedback through surveys, usability tests, and analytics, we gain valuable insights into user needs and pain points, which inform design improvements and optimizatisign-04-14 team will collaborate closely with stakeholders to prioritize and implement changes that address identified issues and align with business objectiuous-04-14 monitoring and iteration are essential to ensure the UI evolves in response to changing user expectations and market dynamics, ultimately driving engagement and loyalty.",
            priority: PRIORITY_LOW,
            status: "completed",
            category: {
              id: "design",
              name: "Design",
            },
            dueDate: "2024-04-14",
            keywords: ["ui", "ux", "feedback"],
          },
          {
            id: 12,
            title: "Security Audit",
            description:
              "Conducting a comprehensive security audit of the system is a proactive measure aimed at identifying and mitigating potential security risks and vulnerabilitluat-04-14ing the system architecture, codebase, and configuration against industry best practices and security standards, we can uncover weaknesses and areas of exposure that may be exploited by malicious actcuri-04-14ty team will utilize a combination of automated tools and manual analysis to assess the system's security posture and identify any gaps or deficiencatio-04-14n efforts will be prioritized based on risk severity, with measures implemented to strengthen defenses and protect sensitive data from unauthorized access or manipulation.",
            priority: PRIORITY_HIGH,
            status: "completed",
            category: {
              id: "security",
              name: "Security",
            },
            dueDate: "2024-04-14",
            keywords: ["security", "audit"],
          },
        ],
        outdated: [
          {
            id: 15,
            title: "Performance Tuning",
            description:
              "Tuning the system for better performance is an ongoing optimization effort aimed at maximizing efficiency and responsiveness across all aspects of the applicatnvol-04-14ves identifying and addressing performance bottlenecks, optimizing code execution, and fine-tuning system configurations to improve resource utilization and reduce lateging-04-14 performance monitoring tools and profiling techniques, the development team will analyze system behavior under different loads and usage scenarios to identify areas for improvementi-04-14ng optimizations and tuning parameters accordingly will result in a more responsive and scalable system that delivers a superior user experience.",
            priority: PRIORITY_HIGH,
            status: "outdated",
            category: {
              id: "performance",
              name: "Performance",
            },
            dueDate: "2025-04-14",
            keywords: ["performance", "tuning"],
          },
          {
            id: 16,
            title: "Email Newsletter Design",
            description:
              "Designing an attractive email newsletter template is a creative endeavor aimed at engaging subscribers and driving conversions through compelling content and visur pr-04-14omoting products, sharing news, or delivering personalized offers, an effective email newsletter design should capture attention, communicate information clearly, and encourage recipients to take actsign-04-14 team will leverage their expertise in email design best practices, including layout optimization, typography, and responsive design, to create a visually appealing and impactful templstin-04-14g and performance analysis will inform iterative refinements to maximize engagement and conversion rates, ultimately driving business growth through email marketing.",
            priority: PRIORITY_MEDIUM,
            status: "outdated",
            category: {
              id: "design",
              name: "Design",
            },
            dueDate: "2025-04-14",
            keywords: ["email", "newsletter", "design"],
          },
        ],
      },
      currentCategory: { id: "general", name: "general" },
      actions: { sort: [], filter: [] },
      categories: [
        { id: "general", name: "general" },
        { id: "web-development", name: "web development" },
        { id: "dutyify-application", name: "dutyify application" },
        { id: "design", name: "design" },
        { id: "performance", name: "Performance" },
        { id: "security", name: "Security" },
        { id: "database", name: "Database" },
        { id: "backend-development", name: "Backend Development" },
        { id: "mobile-development", name: "Mobile Development" },
        { id: "marketing", name: "Marketing" },
        { id: "documentation", name: "Documentation" },
        { id: "testing", name: "Testing" },
      ],
    };
  }
  // I'll use localStorage for now [Maybe change later]
  localStorage.setItem("dutyify_app", JSON.stringify(data));
}
function getData() {
  return JSON.parse(localStorage.getItem("dutyify_app"));
}
function initData() {
  // Check if there isn't stored data then set our placeholder data
  const storedData = localStorage.getItem("dutyify_app");
  if (!storedData) storeData();

  return getData();
}
