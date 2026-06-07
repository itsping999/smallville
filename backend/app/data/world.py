"""World data — locations, objects, and street network for Maplewood."""
from app.models.world import Location, WorldObject, StreetEdge, Weather, WorldState


def create_world() -> WorldState:
    """Create the full Maplewood world."""
    locations = {}
    objects_map = {}

    # ── Houses (Oak Lane) ──────────────────────────────────────
    houses = [
        ("house_1", "1 Oak Lane", "The Chen residence. A cozy two-story house with a well-kept garden and a tire swing in the front yard.", 10, 8),
        ("house_2", "3 Oak Lane", "The Williams home. A craftsman-style house with a front porch and wind chimes.", 18, 8),
        ("house_3", "5 Oak Lane", "Henderson house. A modest ranch-style home with a woodworking shed in the back.", 26, 8),
        ("house_4", "7 Oak Lane", "Patel residence. A modern townhouse with a small zen garden.", 34, 8),
        ("house_5", "9 Oak Lane", "The Moreno family home. A warm, colorful house with kids' toys in the yard.", 42, 8),
        ("house_6", "11 Oak Lane", "Fisher house. A quiet colonial with bird feeders and Hemingway the cat in the window.", 50, 8),
    ]
    for hid, name, desc, x, y in houses:
        loc = Location(id=hid, name=name, type="house", description=desc, x=x, y=y, width=6, height=5, is_outdoor=False, is_public=False, capacity=6)
        loc.objects = [
            WorldObject(id=f"{hid}_bed", name="Bed", description="A comfortable bed", possible_actions=["sleep", "rest", "read_in_bed"]),
            WorldObject(id=f"{hid}_kitchen", name="Kitchen", description="A kitchen with stove and fridge", possible_actions=["cook", "eat", "get_ingredients"]),
            WorldObject(id=f"{hid}_bathroom", name="Bathroom", description="A bathroom with shower", possible_actions=["shower", "brush_teeth", "use_toilet"]),
            WorldObject(id=f"{hid}_couch", name="Living Room", description="A cozy living area", possible_actions=["watch_tv", "relax", "read"]),
            WorldObject(id=f"{hid}_desk", name="Desk", description="A desk with computer", possible_actions=["work", "browse_internet", "study"]),
        ]
        locations[hid] = loc

    # ── Apartments (Maple Court) ──────────────────────────────
    for apt_id, name, desc, x, y in [
        ("apt_101", "Apt 101, Maple Court", "Kai's small but cozy studio apartment. Anime posters on the wall, a gaming PC setup.", 55, 42),
        ("apt_102", "Apt 102, Maple Court", "Zoe's bright apartment with plants everywhere and a guitar in the corner.", 61, 42),
    ]:
        loc = Location(id=apt_id, name=name, type="apartment", description=desc, x=x, y=y, width=5, height=4, is_outdoor=False, is_public=False, capacity=3)
        loc.objects = [
            WorldObject(id=f"{apt_id}_bed", name="Bed", possible_actions=["sleep", "rest"]),
            WorldObject(id=f"{apt_id}_kitchen", name="Kitchenette", possible_actions=["cook", "eat"]),
            WorldObject(id=f"{apt_id}_desk", name="Desk", possible_actions=["work", "browse_internet", "gaming"]),
        ]
        locations[apt_id] = loc

    # ── Main Street Commercial ─────────────────────────────────
    locations["sunrise_cafe"] = Location(
        id="sunrise_cafe", name="Sunrise Cafe", type="cafe",
        description="The heart of Maplewood's social scene. Warm lighting, the smell of fresh coffee, and Rosa's friendly smile behind the counter. A community bulletin board by the door.",
        x=8, y=22, width=7, height=5, is_outdoor=False, is_public=True, capacity=20,
        opening_hours=(6, 20),
    )
    locations["sunrise_cafe"].objects = [
        WorldObject(id="cafe_counter", name="Counter", possible_actions=["order_coffee", "order_food", "chat_with_barista"]),
        WorldObject(id="cafe_table_1", name="Dining Table", possible_actions=["eat", "drink", "read", "socialize"]),
        WorldObject(id="cafe_table_2", name="Dining Table", possible_actions=["eat", "drink", "read", "socialize"]),
        WorldObject(id="cafe_bulletin", name="Bulletin Board", possible_actions=["read_announcements", "post_notice"]),
    ]

    locations["greenleaf_grocery"] = Location(
        id="greenleaf_grocery", name="Greenleaf Grocery", type="grocery",
        description="A well-stocked neighborhood grocery with fresh produce, a deli counter, and all the essentials. The owner knows most customers by name.",
        x=18, y=22, width=7, height=5, is_outdoor=False, is_public=True, capacity=25,
        opening_hours=(7, 21),
    )
    locations["greenleaf_grocery"].objects = [
        WorldObject(id="grocery_aisles", name="Aisles", possible_actions=["browse", "shop"]),
        WorldObject(id="grocery_checkout", name="Checkout", possible_actions=["pay", "chat"]),
        WorldObject(id="grocery_deli", name="Deli Counter", possible_actions=["order_deli", "sample"]),
    ]

    locations["birch_barrel"] = Location(
        id="birch_barrel", name="Birch & Barrel", type="restaurant",
        description="A rustic restaurant and bar with exposed brick, craft cocktails, and live music on weekends. Popular for date nights and after-work drinks.",
        x=28, y=22, width=7, height=5, is_outdoor=False, is_public=True, capacity=30,
        opening_hours=(11, 23),
    )
    locations["birch_barrel"].objects = [
        WorldObject(id="bar_counter", name="Bar", possible_actions=["order_drink", "socialize"]),
        WorldObject(id="bar_table", name="Dining Table", possible_actions=["eat_dinner", "drink"]),
        WorldObject(id="bar_stage", name="Stage", possible_actions=["watch_performance"]),
    ]

    locations["pages_bookstore"] = Location(
        id="pages_bookstore", name="Pages Bookstore", type="bookstore",
        description="A beloved independent bookshop with creaky wooden floors, a reading nook with armchairs, and the smell of old paper. Marcus curates the selection personally.",
        x=38, y=22, width=6, height=5, is_outdoor=False, is_public=True, capacity=12,
        opening_hours=(9, 19),
    )
    locations["pages_bookstore"].objects = [
        WorldObject(id="bookstore_shelves", name="Bookshelves", possible_actions=["browse", "read", "buy_book"]),
        WorldObject(id="bookstore_nook", name="Reading Nook", possible_actions=["read", "relax"]),
    ]

    locations["corner_pharmacy"] = Location(
        id="corner_pharmacy", name="Corner Pharmacy", type="pharmacy",
        description="A small pharmacy with over-the-counter medications, personal care items, and a helpful pharmacist.",
        x=47, y=22, width=5, height=5, is_outdoor=False, is_public=True, capacity=8,
        opening_hours=(8, 20),
    )
    locations["corner_pharmacy"].objects = [
        WorldObject(id="pharmacy_counter", name="Counter", possible_actions=["fill_prescription", "buy_medicine", "ask_pharmacist"]),
    ]

    # ── Community Facilities ───────────────────────────────────
    locations["school"] = Location(
        id="school", name="Maplewood Elementary", type="school",
        description="A cheerful brick schoolhouse with a colorful playground, American flag out front, and the sound of children at recess.",
        x=45, y=30, width=10, height=7, is_outdoor=False, is_public=True, capacity=100,
        opening_hours=(7, 16),
    )
    locations["school"].objects = [
        WorldObject(id="school_playground", name="Playground", possible_actions=["play", "supervise"]),
    ]
    # Sub-locations
    locations["school_classroom_a"] = Location(
        id="school_classroom_a", name="Classroom A", type="classroom",
        description="Sarah Chen's 3rd grade classroom. Colorful posters on the walls, small desks arranged in groups.",
        parent_id="school", x=46, y=31, width=4, height=3, is_outdoor=False, is_public=False, capacity=30,
    )
    locations["school_classroom_a"].objects = [
        WorldObject(id="class_a_desk", name="Teacher's Desk", possible_actions=["teach", "grade_papers"]),
        WorldObject(id="class_a_whiteboard", name="Whiteboard", possible_actions=["write", "present"]),
    ]

    locations["community_center"] = Location(
        id="community_center", name="Maplewood Community Center", type="community_center",
        description="A modern community center with a gym, meeting rooms, and a lobby with local event flyers. James Henderson volunteers here most afternoons.",
        x=8, y=13, width=8, height=6, is_outdoor=False, is_public=True, capacity=50,
        opening_hours=(6, 22),
    )
    locations["community_center"].objects = [
        WorldObject(id="cc_gym", name="Gym", possible_actions=["exercise", "lift_weights", "use_treadmill"]),
        WorldObject(id="cc_meeting_room", name="Meeting Room", possible_actions=["attend_meeting", "present"]),
    ]

    locations["elm_park"] = Location(
        id="elm_park", name="Elm Park", type="park",
        description="A beautiful neighborhood park with mature elm trees, a walking trail around a small pond, a gazebo for community events, and a children's playground. The heart of outdoor life in Maplewood.",
        x=20, y=2, width=15, height=9, is_outdoor=True, is_public=True, capacity=100,
    )
    locations["elm_park"].objects = [
        WorldObject(id="park_trail", name="Walking Trail", possible_actions=["jog", "walk", "walk_dog"]),
        WorldObject(id="park_pond", name="Pond", possible_actions=["sit_by", "feed_ducks", "fish"]),
        WorldObject(id="park_gazebo", name="Gazebo", possible_actions=["socialize", "rest", "hold_event"]),
        WorldObject(id="park_playground", name="Playground", possible_actions=["play", "supervise"]),
        WorldObject(id="park_bench_1", name="Park Bench", possible_actions=["sit", "rest", "read", "observe"]),
        WorldObject(id="park_bench_2", name="Park Bench", possible_actions=["sit", "rest", "read", "observe"]),
    ]

    locations["fire_station"] = Location(
        id="fire_station", name="Maplewood Fire Station", type="fire_station",
        description="The local fire station, always ready. Red truck visible through the open bay doors.",
        x=18, y=13, width=5, height=6, is_outdoor=False, is_public=False, capacity=10,
    )

    # ── Workplaces ─────────────────────────────────────────────
    locations["town_hall"] = Location(
        id="town_hall", name="Maplewood Town Hall", type="government",
        description="A stately brick building with columns out front. The mayor's office, town clerk, and meeting hall are inside.",
        x=40, y=42, width=8, height=6, is_outdoor=False, is_public=True, capacity=30,
        opening_hours=(8, 17),
    )
    locations["town_hall"].objects = [
        WorldObject(id="th_mayor_office", name="Mayor's Office", possible_actions=["meet_mayor", "discuss_policy"]),
        WorldObject(id="th_meeting_hall", name="Meeting Hall", possible_actions=["attend_meeting", "present"]),
    ]

    locations["riverside_tech"] = Location(
        id="riverside_tech", name="Riverside Tech", type="office",
        description="A small tech startup in a converted warehouse. Open-plan office with standing desks, a ping-pong table, and an espresso machine. About 10 employees work here.",
        x=10, y=42, width=8, height=6, is_outdoor=False, is_public=False, capacity=20,
        opening_hours=(8, 18),
    )
    locations["riverside_tech"].objects = [
        WorldObject(id="rt_desk", name="Workstation", possible_actions=["work", "code", "attend_meeting"]),
        WorldObject(id="rt_kitchen", name="Kitchen", possible_actions=["make_coffee", "eat_lunch", "socialize"]),
        WorldObject(id="rt_pingpong", name="Ping-Pong Table", possible_actions=["play_pingpong", "socialize"]),
    ]

    locations["medical_center"] = Location(
        id="medical_center", name="Maplewood Medical Center", type="medical",
        description="A clean, modern medical clinic with a friendly reception staff. Aisha Patel works the morning and afternoon shifts.",
        x=30, y=13, width=7, height=6, is_outdoor=False, is_public=True, capacity=20,
        opening_hours=(7, 19),
    )
    locations["medical_center"].objects = [
        WorldObject(id="mc_reception", name="Reception", possible_actions=["check_in", "schedule_appointment"]),
        WorldObject(id="mc_exam_room", name="Exam Room", possible_actions=["see_doctor", "get_checkup"]),
    ]

    locations["library"] = Location(
        id="library", name="Maplewood Community Library", type="library",
        description="A warm, inviting public library with tall shelves, a children's reading area with beanbags, and a quiet study section with computers. Bob Fisher's domain.",
        x=55, y=13, width=7, height=6, is_outdoor=False, is_public=True, capacity=25,
        opening_hours=(9, 20),
    )
    locations["library"].objects = [
        WorldObject(id="lib_shelves", name="Bookshelves", possible_actions=["browse", "borrow_book", "return_book"]),
        WorldObject(id="lib_computers", name="Computer Lab", possible_actions=["browse_internet", "research"]),
        WorldObject(id="lib_reading", name="Reading Area", possible_actions=["read", "study"]),
    ]

    # ── Streets (graph edges) ──────────────────────────────────
    streets = [
        StreetEdge(from_location="house_1", to_location="house_2", distance_km=0.2),
        StreetEdge(from_location="house_2", to_location="house_3", distance_km=0.2),
        StreetEdge(from_location="house_3", to_location="house_4", distance_km=0.2),
        StreetEdge(from_location="house_4", to_location="house_5", distance_km=0.2),
        StreetEdge(from_location="house_5", to_location="house_6", distance_km=0.2),
        StreetEdge(from_location="house_1", to_location="sunrise_cafe", distance_km=0.5),
        StreetEdge(from_location="house_3", to_location="pages_bookstore", distance_km=0.6),
        StreetEdge(from_location="house_5", to_location="greenleaf_grocery", distance_km=0.5),
        StreetEdge(from_location="sunrise_cafe", to_location="greenleaf_grocery", distance_km=0.3),
        StreetEdge(from_location="greenleaf_grocery", to_location="birch_barrel", distance_km=0.3),
        StreetEdge(from_location="birch_barrel", to_location="pages_bookstore", distance_km=0.3),
        StreetEdge(from_location="pages_bookstore", to_location="corner_pharmacy", distance_km=0.3),
        StreetEdge(from_location="corner_pharmacy", to_location="school", distance_km=0.4),
        StreetEdge(from_location="house_1", to_location="elm_park", distance_km=0.4),
        StreetEdge(from_location="elm_park", to_location="community_center", distance_km=0.3),
        StreetEdge(from_location="elm_park", to_location="medical_center", distance_km=0.5),
        StreetEdge(from_location="community_center", to_location="fire_station", distance_km=0.2),
        StreetEdge(from_location="sunrise_cafe", to_location="riverside_tech", distance_km=0.8),
        StreetEdge(from_location="greenleaf_grocery", to_location="town_hall", distance_km=0.7),
        StreetEdge(from_location="school", to_location="library", distance_km=0.5),
        StreetEdge(from_location="riverside_tech", to_location="apt_101", distance_km=0.6),
        StreetEdge(from_location="apt_101", to_location="apt_102", distance_km=0.1),
        StreetEdge(from_location="apt_101", to_location="town_hall", distance_km=0.5),
        StreetEdge(from_location="house_6", to_location="library", distance_km=0.4),
    ]
    # Make all edges bidirectional by adding reverse edges
    bidirectional = []
    for e in streets:
        bidirectional.append(e)
        bidirectional.append(StreetEdge(
            from_location=e.to_location, to_location=e.from_location,
            distance_km=e.distance_km, is_drivable=e.is_drivable,
            is_walkable=e.is_walkable, is_bikeable=e.is_bikeable,
        ))

    return WorldState(
        locations=locations,
        street_graph=bidirectional,
        weather=Weather(),
    )


def get_travel_time(distance_km: float, mode: str, hour: int = 12) -> float:
    """Returns travel time in sim-minutes."""
    speeds = {"walking": 5.0, "cycling": 15.0, "driving": 40.0}  # km/h
    speed = speeds.get(mode, 5.0)
    # Rush hour
    if mode == "driving" and (7 <= hour <= 9 or 17 <= hour <= 19):
        speed *= 0.6
    hours = distance_km / speed
    return hours * 60  # Convert to minutes
